import { Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ConsumerInquiry, InquiryItem, InquiryStatus } from '../../../core/models/inquiry.model';
import {
  InquiryTimelineEntry,
  InquiryTimelineAttachment,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { ChatAudioPlayerComponent } from '../../../shared/components/chat-audio-player/chat-audio-player.component';
import {
  getConsumerInquiryDisplay,
  formatExpectedDeliveryDate,
  getInquiryListStep,
} from '../../../shared/utils/inquiry-display.util';
import {
  buildReplyPreview,
  canReplyToTimelineEntry,
  ChatReplyTarget,
  quotedMessageElementId,
  replyAuthorLabel,
  replyTargetAuthorLabel,
  replyTargetLabel,
  shouldShowBubbleReply,
} from '../../../shared/utils/chat-reply.util';
import {
  buildConsumerChatTimelineEntries,
  isFinalQuotationNotice,
  isTimelineNotice,
  noticeDisplayDetail,
  noticeDisplayLabel,
} from '../../../shared/utils/timeline-chat.util';
import { quotationLinePricingFromAdmin } from '../../../shared/utils/inquiry-pricing.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { formatSpecificationsInline } from '../../../shared/utils/specifications-display.util';
import { toItemTimelineAttachment } from '../../../shared/utils/attachment-media-type.util';

type StatusFilter = 'all' | InquiryStatus | 'ACTION_REQUIRED';
type SortBy = 'date' | 'inquiryNumber' | 'productCount';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: TimelineAttachmentMediaType;
}

@Component({
  selector: 'app-inquiry-tracking',
  imports: [
    FormsModule,
    InquiryChatAttachmentComponent,
    ChatAudioPlayerComponent,
    LoadingOverlayComponent,
  ],
  templateUrl: './inquiry-tracking.component.html',
  styleUrl: './inquiry-tracking.component.css',
})
export class InquiryTrackingComponent implements OnInit, OnDestroy {
  private readonly inquiryService = inject(InquiryService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly deepLinkError = signal<string | null>(null);
  readonly inquiries = signal<ConsumerInquiry[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly sortBy = signal<SortBy>('date');
  readonly selectedId = signal<string | null>(null);

  readonly timelineLoading = signal(false);
  readonly timelineRefreshing = signal(false);
  readonly timelineError = signal<string | null>(null);
  readonly timelineEntries = signal<InquiryTimelineEntry[]>([]);

  readonly messageText = signal('');
  readonly messageLoading = signal(false);
  readonly messageError = signal<string | null>(null);
  readonly replyTarget = signal<ChatReplyTarget | null>(null);
  readonly pendingAttachments = signal<PendingAttachment[]>([]);
  readonly recording = signal(false);
  readonly recordingSeconds = signal(0);
  readonly recordingLevels = signal<number[]>(Array.from({ length: 24 }, () => 0.15));

  readonly deleteLoading = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteConfirmOpen = signal(false);
  readonly chatModalOpen = signal(false);
  readonly chatModalPosition = signal<{ x: number; y: number } | null>(null);
  readonly chatModalSize = signal<{ width: number; height: number } | null>(null);
  readonly quotationPdfViewerOpen = signal(false);
  readonly quotationPdfSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly quotationPdfViewerFileName = signal('');
  readonly itemAttachmentViewerOpen = signal(false);
  readonly itemAttachmentViewerItem = signal<InquiryItem | null>(null);

  private readonly detailScrollRef = viewChild<ElementRef<HTMLElement>>('detailScroll');
  private readonly chatScrollRef = viewChild<ElementRef<HTMLElement>>('chatScroll');
  private readonly messageInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelAnimationId: number | null = null;
  private durationTimerId: ReturnType<typeof setInterval> | null = null;
  private recordingStartedAt = 0;
  private discardRecording = false;
  private recordingMimeType = 'audio/webm';
  private readonly recordingBarCount = 24;
  private quotationPdfViewerObjectUrl: string | null = null;
  private chatDragState: {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;
  private chatResizeState: {
    pointerId: number;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null = null;
  private readonly chatModalDefaultWidth = 720;
  private readonly chatModalMinWidth = 420;
  private readonly chatModalMinHeight = 420;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'NEW', label: 'New / submitted' },
    { value: 'ACTION_REQUIRED', label: 'Action required' },
    { value: 'SENT_TO_DISTRIBUTORS', label: 'Checking inventory' },
    { value: 'RESPONSES_RECEIVED', label: 'Responses received' },
    { value: 'FINAL_SENT', label: 'Quotation ready' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly sortOptions: { value: SortBy; label: string }[] = [
    { value: 'date', label: 'Date (newest first)' },
    { value: 'inquiryNumber', label: 'Quotation number' },
    { value: 'productCount', label: 'Product count' },
  ];

  readonly filteredInquiries = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return this.inquiries().filter((inquiry) => {
      if (status === 'ACTION_REQUIRED') {
        if (!inquiry.needsClarification) {
          return false;
        }
      } else if (status !== 'all' && inquiry.status !== status) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        inquiry.inquiryId,
        inquiry.title,
        inquiry.description,
        inquiry.searchTerm,
        ...(inquiry.items ?? []).flatMap((item) => [
          item.productBrand,
          item.productName,
          item.notes,
          item.expectedDeliveryDate,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  readonly sortedInquiries = computed(() => {
    const items = [...this.filteredInquiries()];
    const sort = this.sortBy();

    if (sort === 'inquiryNumber') {
      return items.sort((a, b) =>
        a.inquiryId.localeCompare(b.inquiryId, undefined, { numeric: true, sensitivity: 'base' }),
      );
    }

    if (sort === 'productCount') {
      return items.sort(
        (a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0) || this.compareInquiryDate(b, a),
      );
    }

    return items.sort((a, b) => this.compareInquiryDate(b, a));
  });

  readonly selectedInquiry = computed(() => {
    const id = this.selectedId();
    if (id == null) {
      return null;
    }
    return this.inquiries().find((q) => q.id === id) ?? null;
  });

  readonly chatTimelineEntries = computed(() =>
    buildConsumerChatTimelineEntries(this.timelineEntries()),
  );

  readonly finalQuotationPdfAttachments = computed(() => {
    const attachments: InquiryTimelineAttachment[] = [];
    for (const entry of this.timelineEntries()) {
      if (!isFinalQuotationNotice(entry)) {
        continue;
      }
      attachments.push(...this.quotationPdfAttachments(entry));
    }
    return attachments;
  });

  readonly finalQuotationOccurredAt = computed(() => {
    const entries = this.timelineEntries().filter((entry) => isFinalQuotationNotice(entry));
    const latest = entries.at(-1);
    return latest?.occurredAt;
  });

  readonly canSendMessage = computed(
    () => this.messageText().trim().length > 0 || this.pendingAttachments().length > 0,
  );

  readonly canReplyTo = canReplyToTimelineEntry;
  readonly buildReplyPreview = buildReplyPreview;
  readonly replyAuthorLabel = replyAuthorLabel;
  readonly replyTargetAuthorLabel = replyTargetAuthorLabel;
  readonly replyTargetLabel = replyTargetLabel;
  readonly shouldShowBubbleReply = shouldShowBubbleReply;
  readonly isTimelineNotice = isTimelineNotice;
  readonly isFinalQuotationNotice = isFinalQuotationNotice;
  readonly noticeDisplayLabel = (entry: InquiryTimelineEntry) =>
    noticeDisplayLabel(entry, 'CONSUMER');
  readonly noticeDisplayDetail = (entry: InquiryTimelineEntry) =>
    noticeDisplayDetail(entry, 'CONSUMER');

  readonly getInquiryListStep = getInquiryListStep;
  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;
  readonly getConsumerInquiryDisplay = getConsumerInquiryDisplay;

  readonly messageFieldLabel = computed(() => {
    const inquiry = this.selectedInquiry();
    if (inquiry?.needsClarification) {
      return 'Your reply to admin (clarification requested)';
    }
    return 'Message to admin (questions or updates)';
  });

  readonly messagePlaceholder = computed(() => {
    const inquiry = this.selectedInquiry();
    if (inquiry?.needsClarification) {
      return 'Provide the details admin asked for…';
    }
    return 'Type your question or update for the admin team…';
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.quotationPdfViewerOpen()) {
      this.closeQuotationPdfViewer();
      return;
    }
    if (this.chatModalOpen()) {
      this.closeChatModal();
      return;
    }
    if (this.deleteConfirmOpen()) {
      this.closeDeleteConfirm();
    }
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(() => {
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.cleanupRecordingResources(false);
    this.closeQuotationPdfViewer();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.deepLinkError.set(null);

    const requestedInquiryRef = this.route.snapshot.queryParamMap.get('inq')?.trim() ?? null;

    this.inquiryService.getMyInquiries().subscribe({
      next: (list) => {
        this.inquiries.set(list);
        this.loading.set(false);

        if (requestedInquiryRef) {
          const match = list.find((inquiry) => inquiry.inquiryId === requestedInquiryRef);
          if (match) {
            this.searchQuery.set('');
            this.statusFilter.set('all');
            this.selectedId.set(match.id);
            this.loadTimeline();
            return;
          }
          this.selectedId.set(null);
          this.timelineEntries.set([]);
          this.deepLinkError.set('No such inquiry exists.');
          return;
        }

        const current = this.selectedId();
        const stillVisible =
          current != null && this.filteredInquiries().some((q) => q.id === current);
        if (!stillVisible) {
          const first = this.sortedInquiries()[0];
          this.selectedId.set(first?.id ?? null);
        }
        if (this.selectedId()) {
          this.loadTimeline();
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your quotation requests.');
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.syncSelection();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as StatusFilter);
    this.syncSelection();
  }

  onSortByChange(value: string): void {
    this.sortBy.set(value as SortBy);
    this.syncSelection();
  }

  selectInquiry(id: string): void {
    this.cancelVoiceRecording();
    this.clearPendingAttachments();
    this.closeChatModal();
    this.closeItemAttachments();
    this.selectedId.set(id);
    this.deepLinkError.set(null);
    this.deleteError.set(null);
    this.messageError.set(null);
    this.messageText.set('');
    this.clearReplyTarget();
    this.timelineEntries.set([]);
    this.loadTimeline();

    const inquiry = this.inquiries().find((item) => item.id === id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: inquiry ? { inq: inquiry.inquiryId } : { inq: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private syncSelection(): void {
    const visible = this.sortedInquiries();
    const current = this.selectedId();
    if (current != null && visible.some((q) => q.id === current)) {
      return;
    }
    this.clearPendingAttachments();
    this.selectedId.set(visible[0]?.id ?? null);
    if (this.selectedId()) {
      this.loadTimeline();
    }
  }

  private refreshInquiryItems(inquiryId: string): void {
    this.inquiryService.getMyInquiries().subscribe({
      next: (list) => {
        const updated = list.find((inquiry) => inquiry.id === inquiryId);
        if (!updated) {
          return;
        }
        this.inquiries.update((current) =>
          current.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, ...updated } : inquiry)),
        );
      },
    });
  }

  loadTimeline(options?: { silent?: boolean; scrollToBottom?: boolean; preserveScroll?: boolean }): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    const scrollEl = this.detailScrollRef()?.nativeElement;
    const previousScrollTop = scrollEl?.scrollTop ?? 0;
    const silent = options?.silent ?? false;

    if (silent) {
      this.timelineRefreshing.set(true);
    } else {
      this.timelineLoading.set(true);
    }
    this.timelineError.set(null);

    this.inquiryService.getTimeline(inquiry.id).subscribe({
      next: (timeline) => {
        this.timelineEntries.set(timeline.entries);
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        this.inquiries.update((list) =>
          list.map((q) =>
            q.id === inquiry.id
              ? {
                  ...q,
                  needsClarification: timeline.needsClarification,
                  status: timeline.currentStatus,
                }
              : q,
          ),
        );

        if (
          timeline.currentStatus === 'FINAL_SENT' ||
          (timeline.entries ?? []).some((entry) => entry.noticeCode === 'FINAL_QUOTATION_SENT')
        ) {
          this.refreshInquiryItems(inquiry.id);
        }

        if (options?.scrollToBottom) {
          this.scrollDetailToBottom();
          this.focusComposeInput();
        } else if (options?.preserveScroll && scrollEl) {
          scrollEl.scrollTop = previousScrollTop;
        }
      },
      error: () => {
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        if (!silent) {
          this.timelineError.set('Could not load messages.');
        }
      },
    });
  }

  sendMessage(): void {
    const inquiry = this.selectedInquiry();
    const message = this.messageText().trim();
    const attachments = this.pendingAttachments().map((item) => item.file);
    const replyToMessageId = this.replyTarget()?.attachment ? undefined : this.replyTarget()?.entry.id;
    const replyToAttachmentId = this.replyTarget()?.attachment?.id;

    if (!inquiry || (!message && attachments.length === 0)) {
      this.messageError.set('Enter a message or attach a file before sending.');
      return;
    }

    this.messageLoading.set(true);
    this.messageError.set(null);

    const request =
      attachments.length > 0
        ? this.inquiryService.postMessageWithAttachments(
            inquiry.id,
            message,
            attachments,
            replyToMessageId,
            replyToAttachmentId,
          )
        : this.inquiryService.postMessage(
            inquiry.id,
            message,
            replyToMessageId,
            replyToAttachmentId,
          );

    request.subscribe({
      next: (updated) => {
        this.messageLoading.set(false);
        this.messageText.set('');
        this.clearReplyTarget();
        this.clearPendingAttachments();
        this.inquiries.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
        this.focusComposeInput();
        this.loadTimeline({ silent: true, scrollToBottom: true });
      },
      error: (err) => {
        this.messageLoading.set(false);
        this.messageError.set(err?.error?.message ?? 'Could not send your message.');
      },
    });
  }

  onComposeEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) {
      return;
    }
    keyboardEvent.preventDefault();
    if (this.canSendMessage() && !this.messageLoading()) {
      this.sendMessage();
    }
  }

  onImageSelected(event: Event): void {
    this.onFilesSelectedWithType(event, 'IMAGE');
  }

  onVideoSelected(event: Event): void {
    this.onFilesSelectedWithType(event, 'VIDEO');
  } 

  onDocumentSelected(event: Event): void {
    this.onFilesSelectedWithType(event, 'DOCUMENT');
  }

  private onFilesSelectedWithType(event: Event, expected: TimelineAttachmentMediaType): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }

    for (const file of Array.from(files)) {
      const mediaType = this.resolveMediaType(file);
      if (mediaType !== expected) {
        const label =
          expected === 'IMAGE'
            ? 'Please choose an image file.'
            : expected === 'VIDEO'
              ? 'Please choose a video file.'
              : 'Please choose a document file (PDF, Word, Excel, etc.).';
        this.messageError.set(label);
        continue;
      }
      this.addPendingFile(file);
    }
    input.value = '';
  }

  async startVoiceRecording(): Promise<void> {
    if (this.recording() || !navigator.mediaDevices?.getUserMedia) {
      this.messageError.set('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordingStream = stream;
      this.recordingChunks = [];
      this.discardRecording = false;

      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.75;
      source.connect(this.analyser);

      const mimeType = this.resolveRecordingMimeType();
      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      this.recordingMimeType = this.mediaRecorder.mimeType || mimeType || 'audio/webm';

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = () => {
        const chunks = this.recordingChunks;
        this.recordingChunks = [];
        this.cleanupRecordingResources(false);

        if (this.discardRecording || chunks.length === 0) {
          this.discardRecording = false;
          return;
        }

        const type = this.recordingMimeType;
        const blob = new Blob(chunks, { type });
        const ext = type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });
        this.addPendingFile(file);
        this.discardRecording = false;
      };

      this.mediaRecorder.start(250);
      this.recordingStartedAt = Date.now();
      this.recordingSeconds.set(0);
      this.recordingLevels.set(Array.from({ length: this.recordingBarCount }, () => 0.15));
      this.recording.set(true);
      this.messageError.set(null);

      this.durationTimerId = setInterval(() => {
        this.recordingSeconds.set(Math.floor((Date.now() - this.recordingStartedAt) / 1000));
      }, 200);
      this.startLevelMonitor();
    } catch {
      this.cleanupRecordingResources(false);
      this.messageError.set('Microphone access was denied or unavailable.');
    }
  }

  stopVoiceRecording(): void {
    if (!this.mediaRecorder || !this.recording()) {
      return;
    }
    this.recording.set(false);
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.requestData();
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
  }

  cancelVoiceRecording(): void {
    if (!this.recording()) {
      return;
    }
    this.discardRecording = true;
    this.stopVoiceRecording();
  }

  formatRecordingTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private resolveRecordingMimeType(): string | undefined {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  }

  private startLevelMonitor(): void {
    if (!this.analyser) {
      return;
    }

    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser || !this.recording()) {
        return;
      }

      this.analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / this.recordingBarCount));
      const levels = Array.from({ length: this.recordingBarCount }, (_, index) => {
        const start = index * step;
        let sum = 0;
        for (let i = 0; i < step && start + i < data.length; i++) {
          sum += data[start + i];
        }
        const avg = sum / step / 255;
        return Math.max(0.12, Math.min(1, avg * 2.8 + 0.08));
      });
      this.recordingLevels.set(levels);
      this.levelAnimationId = requestAnimationFrame(tick);
    };

    tick();
  }

  private cleanupRecordingResources(resetDiscardFlag: boolean): void {
    if (this.levelAnimationId != null) {
      cancelAnimationFrame(this.levelAnimationId);
      this.levelAnimationId = null;
    }
    if (this.durationTimerId != null) {
      clearInterval(this.durationTimerId);
      this.durationTimerId = null;
    }
    this.recordingStream?.getTracks().forEach((track) => track.stop());
    this.recordingStream = null;
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.recording.set(false);
    this.recordingSeconds.set(0);
    this.recordingLevels.set(Array.from({ length: this.recordingBarCount }, () => 0.15));
    if (resetDiscardFlag) {
      this.discardRecording = false;
    }
  }

  removePendingAttachment(id: string): void {
    this.pendingAttachments.update((items) => {
      const removed = items.find((item) => item.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return items.filter((item) => item.id !== id);
    });
  }

  pendingIcon(mediaType: TimelineAttachmentMediaType): string {
    switch (mediaType) {
      case 'IMAGE':
        return '🖼';
      case 'VIDEO':
        return '🎬';
      case 'AUDIO':
        return '🎤';
      case 'DOCUMENT':
        return '📄';
      default:
        return '📎';
    }
  }

  isConsumerMessage(entry: InquiryTimelineEntry): boolean {
    return entry.actorRole === 'CONSUMER';
  }

  isAdminMessage(entry: InquiryTimelineEntry): boolean {
    return entry.actorRole === 'ADMIN';
  }

  isAudioOnlyMessage(entry: InquiryTimelineEntry): boolean {
    const hasText = !!entry.message?.trim();
    const attachments = entry.attachments ?? [];
    return !hasText && attachments.length > 0 && attachments.every((a) => a.mediaType === 'AUDIO');
  }

  isMediaOnlyMessage(entry: InquiryTimelineEntry): boolean {
    const hasText = !!entry.message?.trim();
    const attachments = entry.attachments ?? [];
    return (
      !hasText &&
      attachments.length > 0 &&
      attachments.every((a) => a.mediaType === 'IMAGE' || a.mediaType === 'VIDEO')
    );
  }

  canMessage(inquiry: ConsumerInquiry): boolean {
    return inquiry.status !== 'CLOSED';
  }

  startReply(entry: InquiryTimelineEntry, event: Event): void {
    event.stopPropagation();
    if (!this.canReplyTo(entry)) {
      return;
    }
    this.replyTarget.set({ entry });
    this.messageError.set(null);
    this.focusComposeInput();
  }

  startReplyToAttachment(
    entry: InquiryTimelineEntry,
    attachment: InquiryTimelineAttachment,
    event: Event,
  ): void {
    event.stopPropagation();
    if (!this.canReplyTo(entry)) {
      return;
    }
    this.replyTarget.set({ entry, attachment });
    this.messageError.set(null);
    this.focusComposeInput();
  }

  clearReplyTarget(): void {
    this.replyTarget.set(null);
  }

  scrollToQuotedMessage(replyTo: InquiryTimelineEntry['replyTo'], event: Event): void {
    if (!replyTo) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const element = document.getElementById(quotedMessageElementId(replyTo));
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.classList.add('chat-row-highlight');
    setTimeout(() => element?.classList.remove('chat-row-highlight'), 1400);
  }

  goToDetailTop(): void {
    this.detailScrollRef()?.nativeElement?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToDetailBottom(): void {
    this.detailScrollRef()?.nativeElement?.scrollTo({
      top: this.detailScrollRef()?.nativeElement.scrollHeight ?? 0,
      behavior: 'smooth',
    });
  }

  openChatModal(): void {
    if (!this.selectedInquiry()) {
      return;
    }
    this.resetChatModalLayout();
    this.chatModalOpen.set(true);
    this.loadTimeline({
      silent: this.timelineEntries().length > 0,
      scrollToBottom: true,
    });
  }

  closeChatModal(): void {
    this.cancelVoiceRecording();
    this.endChatPointerInteraction();
    this.chatModalOpen.set(false);
    this.resetChatModalLayout();
  }

  startChatDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select')) {
      return;
    }

    const dialog = (event.currentTarget as HTMLElement | null)?.closest(
      '.chat-modal-dialog',
    ) as HTMLElement | null;
    if (!dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    this.chatModalPosition.set({ x: rect.left, y: rect.top });
    this.chatModalSize.set({
      width: this.chatModalSize()?.width ?? Math.round(rect.width),
      height: this.chatModalSize()?.height ?? Math.round(rect.height),
    });
    this.chatDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    dialog.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  startChatResize(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();

    const dialog = (event.currentTarget as HTMLElement | null)?.closest(
      '.chat-modal-dialog',
    ) as HTMLElement | null;
    if (!dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();
    this.chatModalPosition.set({
      x: this.chatModalPosition()?.x ?? rect.left,
      y: this.chatModalPosition()?.y ?? rect.top,
    });
    this.chatModalSize.set({
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    this.chatResizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: Math.round(rect.width),
      originHeight: Math.round(rect.height),
    };
    dialog.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  onChatPointerMove(event: PointerEvent): void {
    if (this.chatDragState && event.pointerId === this.chatDragState.pointerId) {
      const deltaX = event.clientX - this.chatDragState.startX;
      const deltaY = event.clientY - this.chatDragState.startY;
      const size = this.chatModalSize();
      const width = size?.width ?? this.chatModalDefaultWidth;
      const height = size?.height ?? this.defaultChatModalHeight();
      const maxX = Math.max(0, window.innerWidth - width);
      const maxY = Math.max(0, window.innerHeight - height);
      this.chatModalPosition.set({
        x: Math.min(maxX, Math.max(0, this.chatDragState.originX + deltaX)),
        y: Math.min(maxY, Math.max(0, this.chatDragState.originY + deltaY)),
      });
      return;
    }

    if (this.chatResizeState && event.pointerId === this.chatResizeState.pointerId) {
      const deltaX = event.clientX - this.chatResizeState.startX;
      const deltaY = event.clientY - this.chatResizeState.startY;
      const maxWidth = Math.max(this.chatModalMinWidth, window.innerWidth - 24);
      const maxHeight = Math.max(this.chatModalMinHeight, window.innerHeight - 24);
      this.chatModalSize.set({
        width: Math.min(
          maxWidth,
          Math.max(this.chatModalMinWidth, this.chatResizeState.originWidth + deltaX),
        ),
        height: Math.min(
          maxHeight,
          Math.max(this.chatModalMinHeight, this.chatResizeState.originHeight + deltaY),
        ),
      });
    }
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  onChatPointerUp(event: PointerEvent): void {
    if (
      (this.chatDragState && event.pointerId === this.chatDragState.pointerId) ||
      (this.chatResizeState && event.pointerId === this.chatResizeState.pointerId)
    ) {
      this.endChatPointerInteraction();
    }
  }

  private resetChatModalLayout(): void {
    this.chatModalPosition.set(null);
    this.chatModalSize.set(null);
  }

  private endChatPointerInteraction(): void {
    this.chatDragState = null;
    this.chatResizeState = null;
  }

  private defaultChatModalHeight(): number {
    return Math.min(Math.round(window.innerHeight * 0.94), 940);
  }

  openQuotationPdf(attachment: InquiryTimelineAttachment): void {
    this.inquiryService.fetchAttachmentBlob(attachment.url).subscribe({
      next: (blob) => {
        this.openPdfInViewer(blob, attachment.contentType || 'application/pdf', attachment.fileName);
      },
      error: () => {
        this.messageError.set('Could not open the quotation PDF.');
      },
    });
  }

  openSubmissionPdf(inquiry: ConsumerInquiry): void {
    this.inquiryService.downloadSubmissionPdf(inquiry.id).subscribe({
      next: (blob) => {
        this.openPdfInViewer(blob, 'application/pdf', this.submissionPdfFileName(inquiry));
      },
      error: () => {
        this.messageError.set('Could not open the request PDF.');
      },
    });
  }

  submissionPdfFileName(inquiry: ConsumerInquiry): string {
    return `${inquiry.inquiryId}.pdf`;
  }

  private openPdfInViewer(blob: Blob, contentType: string, fileName: string): void {
    this.closeQuotationPdfViewer();
    const typedBlob = this.toPdfBlob(blob, contentType);
    this.quotationPdfViewerObjectUrl = URL.createObjectURL(typedBlob);
    this.quotationPdfSafeUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(this.quotationPdfViewerObjectUrl),
    );
    this.quotationPdfViewerFileName.set(fileName);
    this.quotationPdfViewerOpen.set(true);
  }

  private toPdfBlob(blob: Blob, contentType: string): Blob {
    if (blob.type === 'application/pdf') {
      return blob;
    }
    const pdfType = contentType.includes('pdf') ? contentType : 'application/pdf';
    return new Blob([blob], { type: pdfType });
  }

  closeQuotationPdfViewer(): void {
    this.quotationPdfViewerOpen.set(false);
    this.quotationPdfSafeUrl.set(null);
    this.quotationPdfViewerFileName.set('');
    if (this.quotationPdfViewerObjectUrl) {
      URL.revokeObjectURL(this.quotationPdfViewerObjectUrl);
      this.quotationPdfViewerObjectUrl = null;
    }
  }

  refreshMessages(): void {
    this.loadTimeline({ silent: true, preserveScroll: true });
  }

  canDelete(inquiry: ConsumerInquiry): boolean {
    return inquiry.status === 'NEW';
  }

  openDeleteConfirm(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry || !this.canDelete(inquiry)) {
      return;
    }
    this.deleteError.set(null);
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleteLoading()) {
      return;
    }
    this.deleteConfirmOpen.set(false);
  }

  confirmDelete(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry || !this.canDelete(inquiry)) {
      this.closeDeleteConfirm();
      return;
    }

    this.deleteLoading.set(true);
    this.deleteError.set(null);

    this.inquiryService.delete(inquiry.id).subscribe({
      next: () => {
        this.inquiries.update((list) => list.filter((q) => q.id !== inquiry.id));
        const first = this.filteredInquiries()[0];
        this.selectedId.set(first?.id ?? null);
        this.deleteLoading.set(false);
        this.deleteConfirmOpen.set(false);
        if (this.selectedId()) {
          this.loadTimeline();
        }
      },
      error: (err) => {
        this.deleteLoading.set(false);
        this.deleteError.set(err?.error?.message ?? 'Could not delete this request.');
        this.deleteConfirmOpen.set(false);
      },
    });
  }

  private compareInquiryDate(a: ConsumerInquiry, b: ConsumerInquiry): number {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);

    if (aValid && bValid) {
      return aTime - bTime;
    }
    if (aValid) {
      return 1;
    }
    if (bValid) {
      return -1;
    }
    return a.inquiryId.localeCompare(b.inquiryId, undefined, { numeric: true, sensitivity: 'base' });
  }

  displayProductField(value?: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  hasFinalPricingLine(item: InquiryItem): boolean {
    return item.adminMrp != null;
  }

  formatCurrency(value: number | null | undefined): string {
    return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatOptionalPercent(value: number | null | undefined): string {
    return value == null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  }

  finalLineAmount(item: InquiryItem): number | null {
    return quotationLinePricingFromAdmin(item).amount;
  }

  finalLineNetValue(item: InquiryItem): number | null {
    return quotationLinePricingFromAdmin(item).netValue;
  }

  quotationPdfAttachments(entry: InquiryTimelineEntry): InquiryTimelineAttachment[] {
    return (entry.attachments ?? []).filter((attachment) => attachment.mediaType === 'DOCUMENT');
  }

  displaySpecifications(value?: string): string {
    const formatted = formatSpecificationsInline(value);
    return formatted ? formatted : '—';
  }

  itemAttachmentCount(item: InquiryItem): number {
    return item.attachments?.length ?? 0;
  }

  openItemAttachments(item: InquiryItem, event: Event): void {
    event.stopPropagation();
    this.itemAttachmentViewerItem.set(item);
    this.itemAttachmentViewerOpen.set(true);
  }

  closeItemAttachments(): void {
    this.itemAttachmentViewerOpen.set(false);
    this.itemAttachmentViewerItem.set(null);
  }

  toItemTimelineAttachment(
    attachment: NonNullable<InquiryItem['attachments']>[number],
  ): InquiryTimelineAttachment {
    return toItemTimelineAttachment(attachment);
  }

  itemAttachmentViewerLabel(item: InquiryItem): string {
    const brand = item.productBrand?.trim();
    const designation = item.productName?.trim();
    if (brand && designation) {
      return `${brand} · ${designation}`;
    }
    return brand || designation || 'Product attachments';
  }

  formatPostedDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }

  formatChatTime(iso?: string): string {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private addPendingFile(file: File): void {
    const mediaType = this.resolveMediaType(file);
    if (!mediaType) {
      this.messageError.set('Unsupported file type. Use image, video, audio, or document.');
      return;
    }

    const previewUrl =
      mediaType === 'IMAGE' || mediaType === 'AUDIO' || mediaType === 'VIDEO'
        ? URL.createObjectURL(file)
        : undefined;
    this.pendingAttachments.update((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        mediaType,
      },
    ]);
    this.messageError.set(null);
  }

  private resolveMediaType(file: File): TimelineAttachmentMediaType | null {
    if (this.isDocumentType(file.type, file.name)) {
      return 'DOCUMENT';
    }
    if (file.type.startsWith('image/')) {
      return 'IMAGE';
    }
    if (file.type.startsWith('video/')) {
      return 'VIDEO';
    }
    if (file.type.startsWith('audio/')) {
      return 'AUDIO';
    }
    const lower = file.name.toLowerCase();
    if (/\.(jpe?g|png|gif|webp)$/.test(lower)) {
      return 'IMAGE';
    }
    if (/\.(mp4|mov)$/.test(lower)) {
      return 'VIDEO';
    }
    if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) {
      return 'AUDIO';
    }
    if (/\.webm$/.test(lower)) {
      return file.type.startsWith('audio/') ? 'AUDIO' : 'VIDEO';
    }
    return null;
  }

  private isDocumentType(contentType: string, fileName: string): boolean {
    const lower = fileName.toLowerCase();
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|pps|ppsx|txt|csv|rtf|odt|ods)$/i.test(lower)) {
      return true;
    }
    const docMimePrefixes = [
      'application/pdf',
      'application/x-pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'application/vnd.ms-word',
      'application/rtf',
      'application/vnd.oasis.opendocument',
      'text/plain',
      'text/csv',
    ];
    if (docMimePrefixes.some((prefix) => contentType.startsWith(prefix))) {
      return true;
    }
    return (!contentType || contentType === 'application/octet-stream') &&
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|pps|ppsx)$/i.test(lower);
  }

  private clearPendingAttachments(): void {
    for (const item of this.pendingAttachments()) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    this.pendingAttachments.set([]);
  }

  private scrollDetailToBottom(): void {
    requestAnimationFrame(() => {
      const scrollEl = this.chatScrollRef()?.nativeElement;
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
      requestAnimationFrame(() => {
        const el = this.chatScrollRef()?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  private focusComposeInput(): void {
    requestAnimationFrame(() => {
      this.messageInputRef()?.nativeElement?.focus();
    });
  }
}
