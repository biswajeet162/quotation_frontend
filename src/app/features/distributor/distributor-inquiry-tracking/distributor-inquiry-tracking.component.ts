import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { DistributorInquiry, DistributorInquirySummary } from '../../../core/models/distributor.model';
import { InquiryItem } from '../../../core/models/inquiry.model';
import {
  InquiryTimelineEntry,
  InquiryTimelineAttachment,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { DistributorInquiryService } from '../../../core/services/distributor/distributor-inquiry.service';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { ChatAudioPlayerComponent } from '../../../shared/components/chat-audio-player/chat-audio-player.component';
import { formatExpectedDeliveryDate, getRequestSourceLabel } from '../../../shared/utils/inquiry-display.util';
import {
  canReplyToTimelineEntry,
  ChatReplyTarget,
  quotedMessageElementId,
  replyAuthorLabel,
  replyTargetAuthorLabel,
  replyTargetLabel,
  shouldShowBubbleReply,
} from '../../../shared/utils/chat-reply.util';
import {
  buildChatTimelineEntries,
  isTimelineNotice,
  noticeDisplayDetail,
  noticeDisplayLabel,
} from '../../../shared/utils/timeline-chat.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { toItemTimelineAttachment } from '../../../shared/utils/attachment-media-type.util';

type StatusFilter = 'all' | 'pending' | 'responded' | 'CLOSED';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: TimelineAttachmentMediaType;
}

interface DistributorInquiryLineDraft {
  hsnCode?: string;
  mrp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  ourDeliveryDate?: string;
}

type PdfViewerSource = 'request' | 'response';

@Component({
  selector: 'app-distributor-inquiry-tracking',
  imports: [FormsModule, InquiryChatAttachmentComponent, ChatAudioPlayerComponent, LoadingOverlayComponent],
  templateUrl: './distributor-inquiry-tracking.component.html',
  styleUrl: './distributor-inquiry-tracking.component.css',
})
export class DistributorInquiryTrackingComponent implements OnInit, OnDestroy {
  private readonly distributorInquiryService = inject(DistributorInquiryService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquirySummaries = signal<DistributorInquirySummary[]>([]);
  readonly selectedInquiry = signal<DistributorInquiry | null>(null);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
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

  readonly itemAttachmentViewerOpen = signal(false);
  readonly itemAttachmentViewerItem = signal<InquiryItem | null>(null);
  readonly lineDrafts = signal<Map<string, DistributorInquiryLineDraft>>(new Map());
  readonly chatPanelOpen = signal(false);
  readonly quotationPanelOpen = signal(false);
  readonly quotationSending = signal(false);
  readonly quotationError = signal<string | null>(null);
  readonly pdfLoading = signal(false);
  readonly pdfAvailable = signal(false);
  readonly responsePdfLoading = signal(false);
  readonly responsePdfAvailable = signal(false);
  readonly pdfViewerOpen = signal(false);
  readonly pdfViewerSource = signal<PdfViewerSource>('request');
  readonly pdfSafeUrl = signal<SafeResourceUrl | null>(null);

  private pdfBlob: Blob | null = null;
  private responsePdfBlob: Blob | null = null;
  private pdfViewerObjectUrl: string | null = null;

  private readonly detailScrollRef = viewChild<ElementRef<HTMLElement>>('detailScroll');
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

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All requests' },
    { value: 'pending', label: 'Awaiting your response' },
    { value: 'responded', label: 'Responded' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  readonly filteredSummaries = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return this.inquirySummaries().filter((summary) => {
      if (status === 'pending') {
        if (summary.responseReceived || summary.status === 'CLOSED') {
          return false;
        }
      } else if (status === 'responded') {
        if (!summary.responseReceived) {
          return false;
        }
      } else if (status === 'CLOSED') {
        if (summary.status !== 'CLOSED') {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack = [summary.reference, summary.title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly chatTimelineEntries = computed(() => buildChatTimelineEntries(this.timelineEntries()));

  readonly distributorMessageEntries = computed(() =>
    this.chatTimelineEntries().filter((entry) => !isTimelineNotice(entry)),
  );

  readonly canSendMessage = computed(
    () => this.messageText().trim().length > 0 || this.pendingAttachments().length > 0,
  );

  readonly canReplyTo = canReplyToTimelineEntry;
  readonly replyAuthorLabel = (replyTo: InquiryTimelineEntry['replyTo']) =>
    replyAuthorLabel(replyTo!, 'DISTRIBUTOR');
  readonly replyTargetAuthorLabel = (target: ChatReplyTarget) =>
    replyTargetAuthorLabel(target, 'DISTRIBUTOR');
  readonly replyTargetLabel = replyTargetLabel;
  readonly shouldShowBubbleReply = shouldShowBubbleReply;
  readonly isTimelineNotice = isTimelineNotice;
  readonly noticeDisplayLabel = (entry: InquiryTimelineEntry) =>
    noticeDisplayLabel(entry, 'DISTRIBUTOR');
  readonly noticeDisplayDetail = (entry: InquiryTimelineEntry) =>
    noticeDisplayDetail(entry, 'DISTRIBUTOR');
  readonly getRequestSourceLabel = getRequestSourceLabel;
  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;

  readonly messageFieldLabel = computed(() => 'Message to admin (quotation or availability)');

  readonly messagePlaceholder = computed(
    () => 'Type your reply, pricing, or availability update for the admin team…',
  );

  ngOnInit(): void {
    const preselect = this.route.snapshot.queryParamMap.get('inquiry');
    if (preselect) {
      this.selectedId.set(preselect);
    }
    this.load();
  }

  ngOnDestroy(): void {
    this.cleanupRecordingResources(false);
    this.clearPendingAttachments();
    this.revokePdfViewerUrl();
    this.pdfBlob = null;
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.distributorInquiryService.list().subscribe({
      next: (list) => {
        this.inquirySummaries.set(list);
        this.loading.set(false);
        const current = this.selectedId();
        const stillVisible =
          current != null && this.filteredSummaries().some((q) => q.inquiryUuid === current);
        if (!stillVisible) {
          this.syncSelection();
        } else if (this.selectedId()) {
          this.loadSelectedInquiry(this.selectedId()!);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load quotation requests.');
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

  selectInquiry(id: string): void {
    this.cancelVoiceRecording();
    this.clearPendingAttachments();
    this.chatPanelOpen.set(false);
    this.quotationPanelOpen.set(false);
    this.closePdfViewer();
    this.quotationError.set(null);
    this.selectedId.set(id);
    this.messageError.set(null);
    this.messageText.set('');
    this.clearReplyTarget();
    this.timelineEntries.set([]);
    this.loadSelectedInquiry(id);
  }

  toggleChatPanel(): void {
    const next = !this.chatPanelOpen();
    this.chatPanelOpen.set(next);
    if (next && this.selectedInquiry()) {
      this.loadTimeline();
    }
  }

  openQuotationPanel(): void {
    this.quotationError.set(null);
    this.quotationPanelOpen.set(true);
  }

  closeQuotationPanel(): void {
    this.quotationPanelOpen.set(false);
    this.quotationError.set(null);
  }

  submissionPdfLabel(inquiry: DistributorInquiry): string {
    return `${inquiry.inquiryId}-request.pdf`;
  }

  distributorQuotationPdfLabel(inquiry: DistributorInquiry): string {
    return `${inquiry.inquiryId}-your-quotation.pdf`;
  }

  hasSubmittedQuotation(inquiry: DistributorInquiry): boolean {
    return !!inquiry.responseReceived;
  }

  submittedQuotationDateLabel(inquiry: DistributorInquiry): string {
    return this.formatQuotationDate(inquiry.responseReceivedAt);
  }

  getSubmittedLineDraft(_inquiryId: string, item: InquiryItem): DistributorInquiryLineDraft {
    return {
      hsnCode: item.distributorHsnCode,
      mrp: item.distributorMrp,
      discountPercentage: item.distributorDiscountPercentage,
      gstPercentage: item.distributorGstPercentage,
      ourDeliveryDate: item.distributorOurDeliveryDate,
    };
  }

  hasSubmittedLine(item: InquiryItem): boolean {
    return item.distributorMrp != null && item.distributorGstPercentage != null;
  }

  submittedLineAmount(inquiryId: string, item: InquiryItem): number | null {
    return this.lineAmount(inquiryId, item, this.getSubmittedLineDraft(inquiryId, item));
  }

  submittedLineNetValue(inquiryId: string, item: InquiryItem): number | null {
    return this.lineNetValue(inquiryId, item, this.getSubmittedLineDraft(inquiryId, item));
  }

  pdfViewerTitle(inquiry: DistributorInquiry): string {
    return this.pdfViewerSource() === 'response' ? 'Your quotation PDF' : 'Quotation PDF';
  }

  pdfViewerLabel(inquiry: DistributorInquiry): string {
    return this.pdfViewerSource() === 'response'
      ? this.distributorQuotationPdfLabel(inquiry)
      : this.submissionPdfLabel(inquiry);
  }

  openPdfViewer(): void {
    this.openPdfViewerForSource('request');
  }

  openResponsePdfViewer(): void {
    this.openPdfViewerForSource('response');
  }

  private openPdfViewerForSource(source: PdfViewerSource): void {
    const blob = source === 'response' ? this.responsePdfBlob : this.pdfBlob;
    if (!blob) {
      return;
    }

    this.pdfViewerSource.set(source);
    this.revokePdfViewerUrl();
    this.pdfViewerObjectUrl = URL.createObjectURL(blob);
    this.pdfSafeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfViewerObjectUrl));
    this.pdfViewerOpen.set(true);
  }

  closePdfViewer(): void {
    this.pdfViewerOpen.set(false);
    this.revokePdfViewerUrl();
  }

  canSubmitQuotation(inquiry: DistributorInquiry): boolean {
    const items = inquiry.items ?? [];
    if (items.length === 0) {
      return false;
    }

    return items.every((item) => {
      const draft = this.getLineDraft(inquiry.id, item);
      return draft.mrp != null && draft.gstPercentage != null;
    });
  }

  sendQuotation(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    if (!this.canMessage(inquiry)) {
      this.quotationError.set('This request is closed. You cannot send a quotation.');
      return;
    }

    if (!this.canSubmitQuotation(inquiry)) {
      this.quotationError.set('Fill MRP and GST % for every product before sending.');
      return;
    }

    const lines = (inquiry.items ?? []).map((item) => {
      const draft = this.getLineDraft(inquiry.id, item);
      return {
        inquiryItemId: item.id ?? item.productId,
        hsnCode: draft.hsnCode,
        mrp: draft.mrp!,
        discountPercentage: draft.discountPercentage,
        gstPercentage: draft.gstPercentage!,
        ourDeliveryDate: draft.ourDeliveryDate,
      };
    });

    this.quotationSending.set(true);
    this.quotationError.set(null);

    this.distributorInquiryService.submitQuotation(inquiry.id, lines).subscribe({
      next: (updated) => {
        this.quotationSending.set(false);
        this.closeQuotationPanel();
        this.selectedInquiry.set(updated);
        this.responsePdfAvailable.set(!!updated.responsePdfAvailable);
        if (updated.responsePdfAvailable) {
          this.loadResponsePdf(updated.id);
        }
        this.inquirySummaries.update((list) =>
          list.map((summary) =>
            summary.inquiryUuid === updated.id
              ? { ...summary, responseReceived: updated.responseReceived, status: updated.status }
              : summary,
          ),
        );
        this.loadTimeline({ silent: true, scrollToBottom: true });
      },
      error: (err) => {
        this.quotationSending.set(false);
        this.quotationError.set(err?.error?.message ?? 'Could not send your quotation.');
      },
    });
  }

  private syncSelection(): void {
    const visible = this.filteredSummaries();
    const current = this.selectedId();
    if (current != null && visible.some((q) => q.inquiryUuid === current)) {
      return;
    }
    this.clearPendingAttachments();
    this.chatPanelOpen.set(false);
    const nextId = visible[0]?.inquiryUuid ?? null;
    this.selectedId.set(nextId);
    this.selectedInquiry.set(null);
    if (nextId) {
      this.loadSelectedInquiry(nextId);
    } else {
      this.timelineEntries.set([]);
    }
  }

  private loadSelectedInquiry(id: string): void {
    this.closePdfViewer();
    this.pdfBlob = null;
    this.pdfAvailable.set(false);
    this.responsePdfBlob = null;
    this.responsePdfAvailable.set(false);
    this.distributorInquiryService.getById(id).subscribe({
      next: (inquiry) => {
        this.selectedInquiry.set(inquiry);
        this.loadSubmissionPdf(id);
        this.responsePdfAvailable.set(!!inquiry.responsePdfAvailable);
        if (inquiry.responsePdfAvailable) {
          this.loadResponsePdf(id);
        }
      },
      error: () => {
        this.selectedInquiry.set(null);
        this.timelineError.set('Could not load this quotation request.');
      },
    });
  }

  private loadSubmissionPdf(inquiryId: string): void {
    this.pdfLoading.set(true);
    this.pdfAvailable.set(false);
    this.pdfBlob = null;

    this.distributorInquiryService.downloadSubmissionPdf(inquiryId).subscribe({
      next: (blob) => {
        this.pdfBlob = blob;
        this.pdfAvailable.set(true);
        this.pdfLoading.set(false);
      },
      error: () => {
        this.pdfLoading.set(false);
        this.pdfAvailable.set(false);
        this.pdfBlob = null;
      },
    });
  }

  private loadResponsePdf(inquiryId: string): void {
    this.responsePdfLoading.set(true);
    this.responsePdfBlob = null;

    this.distributorInquiryService.downloadQuotationPdf(inquiryId).subscribe({
      next: (blob) => {
        this.responsePdfBlob = blob;
        this.responsePdfAvailable.set(true);
        this.responsePdfLoading.set(false);
      },
      error: () => {
        this.responsePdfLoading.set(false);
        this.responsePdfAvailable.set(false);
        this.responsePdfBlob = null;
      },
    });
  }

  private revokePdfViewerUrl(): void {
    if (this.pdfViewerObjectUrl) {
      URL.revokeObjectURL(this.pdfViewerObjectUrl);
      this.pdfViewerObjectUrl = null;
    }
    this.pdfSafeUrl.set(null);
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

    this.distributorInquiryService.getTimeline(inquiry.id).subscribe({
      next: (timeline) => {
        this.timelineEntries.set(timeline.entries ?? []);
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        this.selectedInquiry.update((current) =>
          current
            ? {
                ...current,
                status: timeline.currentStatus ?? current.status,
              }
            : current,
        );
        this.inquirySummaries.update((list) =>
          list.map((summary) =>
            summary.inquiryUuid === inquiry.id
              ? {
                  ...summary,
                  status: timeline.currentStatus ?? summary.status,
                }
              : summary,
          ),
        );

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
        ? this.distributorInquiryService.postMessageWithAttachments(
            inquiry.id,
            message,
            attachments,
            replyToMessageId,
            replyToAttachmentId,
          )
        : this.distributorInquiryService.postMessage(
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
        this.selectedInquiry.set(updated);
        this.inquirySummaries.update((list) =>
          list.map((summary) =>
            summary.inquiryUuid === updated.id
              ? { ...summary, responseReceived: updated.responseReceived, status: updated.status }
              : summary,
          ),
        );
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

  isDistributorMessage(entry: InquiryTimelineEntry): boolean {
    return entry.actorRole === 'DISTRIBUTOR';
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

  canMessage(inquiry: DistributorInquiry): boolean {
    return inquiry.status !== 'CLOSED';
  }

  getDistributorListStep(summary: DistributorInquirySummary): 'grey' | 'yellow' | 'green' {
    if (summary.status === 'CLOSED' || summary.responseReceived) {
      return 'green';
    }
    return 'yellow';
  }

  summaryStatusLabel(summary: DistributorInquirySummary): string {
    if (summary.status === 'CLOSED') {
      return 'Closed';
    }
    return summary.responseReceived ? 'Responded' : 'Awaiting response';
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
    this.loadTimeline({ silent: true, scrollToBottom: true });
  }

  refreshMessages(): void {
    this.loadTimeline({ silent: true, preserveScroll: true });
  }

  productCountLabel(items?: DistributorInquiry['items']): string {
    const count = items?.length ?? 0;
    return count === 1 ? '1 product' : `${count} products`;
  }

  totalItemQuantity(items?: DistributorInquiry['items']): number {
    return (items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  }

  displayProductField(value?: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  lineDraftKey(inquiryId: string, item: InquiryItem): string {
    return `${inquiryId}:${item.id ?? item.productId}`;
  }

  getLineDraft(inquiryId: string, item: InquiryItem): DistributorInquiryLineDraft {
    return this.lineDrafts().get(this.lineDraftKey(inquiryId, item)) ?? {};
  }

  updateLineTextField(
    inquiryId: string,
    item: InquiryItem,
    field: 'hsnCode',
    value: string,
  ): void {
    const trimmed = value.trim();
    this.patchLineDraft(inquiryId, item, { [field]: trimmed || undefined });
  }

  updateLineNumberField(
    inquiryId: string,
    item: InquiryItem,
    field: 'mrp' | 'discountPercentage' | 'gstPercentage',
    value: string | number | null,
  ): void {
    const parsed = this.parseOptionalNumber(value);
    this.patchLineDraft(inquiryId, item, { [field]: parsed ?? undefined });
  }

  updateLineDateField(inquiryId: string, item: InquiryItem, value: string): void {
    const trimmed = value.trim();
    this.patchLineDraft(inquiryId, item, { ourDeliveryDate: trimmed || undefined });
  }

  isRequiredFieldMissing(
    inquiryId: string,
    item: InquiryItem,
    field: 'mrp' | 'gstPercentage',
  ): boolean {
    const draft = this.getLineDraft(inquiryId, item);
    if (field === 'mrp') {
      return draft.mrp == null;
    }
    return draft.gstPercentage == null;
  }

  lineAmount(inquiryId: string, item: InquiryItem, draft?: DistributorInquiryLineDraft): number | null {
    const lineDraft = draft ?? this.getLineDraft(inquiryId, item);
    if (lineDraft.mrp == null) {
      return null;
    }

    const discount = lineDraft.discountPercentage ?? 0;
    const unitAfterDiscount = lineDraft.mrp * (1 - discount / 100);
    return unitAfterDiscount * item.quantity;
  }

  lineNetValue(
    inquiryId: string,
    item: InquiryItem,
    draft?: DistributorInquiryLineDraft,
  ): number | null {
    const amount = this.lineAmount(inquiryId, item, draft);
    if (amount == null) {
      return null;
    }

    const lineDraft = draft ?? this.getLineDraft(inquiryId, item);
    const gst = lineDraft.gstPercentage ?? 0;
    return amount * (1 + gst / 100);
  }

  formatCurrency(value: number | null | undefined): string {
    return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatOptionalNumber(value?: number): string {
    return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatOptionalPercent(value?: number): string {
    return value == null ? '—' : `${value}%`;
  }

  adminLineAmount(item: InquiryItem): number | null {
    if (item.adminMrp == null) {
      return null;
    }

    const discount = item.adminDiscountPercentage ?? 0;
    const unitAfterDiscount = item.adminMrp * (1 - discount / 100);
    return unitAfterDiscount * item.quantity;
  }

  adminLineNetValue(item: InquiryItem): number | null {
    const amount = this.adminLineAmount(item);
    if (amount == null) {
      return null;
    }

    const gst = item.adminGstPercentage ?? 0;
    return amount * (1 + gst / 100);
  }

  itemAttachmentCount(item: InquiryItem): number {
    return item.attachments?.length ?? 0;
  }

  itemAttachmentLabel(item: InquiryItem): string {
    const count = this.itemAttachmentCount(item);
    return count === 1 ? '1 image' : `${count} images`;
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
    return brand || designation || 'Product images';
  }

  formatDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }

  formatQuotationDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
    return (
      (!contentType || contentType === 'application/octet-stream') &&
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|pps|ppsx)$/i.test(lower)
    );
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
      const scrollEl = this.detailScrollRef()?.nativeElement;
      if (scrollEl) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
      requestAnimationFrame(() => {
        const el = this.detailScrollRef()?.nativeElement;
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

  private patchLineDraft(
    inquiryId: string,
    item: InquiryItem,
    patch: Partial<DistributorInquiryLineDraft>,
  ): void {
    const key = this.lineDraftKey(inquiryId, item);
    this.lineDrafts.update((drafts) => {
      const next = new Map(drafts);
      next.set(key, { ...(next.get(key) ?? {}), ...patch });
      return next;
    });
  }

  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === '' || value == null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
