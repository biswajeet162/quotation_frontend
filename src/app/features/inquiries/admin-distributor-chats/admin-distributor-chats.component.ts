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
import { ActivatedRoute } from '@angular/router';
import { Inquiry, InquiryDistributor } from '../../../core/models/inquiry.model';
import {
  InquiryTimelineEntry,
  InquiryTimelineAttachment,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { ChatAudioPlayerComponent } from '../../../shared/components/chat-audio-player/chat-audio-player.component';
import { getRequestSourceLabel } from '../../../shared/utils/inquiry-display.util';
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

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: TimelineAttachmentMediaType;
}

@Component({
  selector: 'app-admin-distributor-chats',
  imports: [FormsModule, InquiryChatAttachmentComponent, ChatAudioPlayerComponent],
  templateUrl: './admin-distributor-chats.component.html',
  styleUrl: './admin-distributor-chats.component.css',
})
export class AdminDistributorChatsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly inquiryService = inject(InquiryService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiry = signal<Inquiry | null>(null);
  readonly searchQuery = signal('');
  readonly selectedDistributorCompanyId = signal<string | null>(null);

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

  readonly distributors = computed(() => {
    const list = this.inquiry()?.distributors ?? [];
    return [...list].sort((a, b) =>
      (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' }),
    );
  });

  readonly filteredDistributors = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) {
      return this.distributors();
    }
    return this.distributors().filter((distributor) => {
      const haystack = (distributor.companyName ?? '').toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly selectedDistributor = computed(() => {
    const id = this.selectedDistributorCompanyId();
    if (!id) {
      return null;
    }
    return this.distributors().find((d) => d.companyId === id) ?? null;
  });

  readonly chatTimelineEntries = computed(() => buildChatTimelineEntries(this.timelineEntries()));

  readonly canSendMessage = computed(
    () => this.messageText().trim().length > 0 || this.pendingAttachments().length > 0,
  );

  readonly canReplyTo = canReplyToTimelineEntry;
  readonly replyAuthorLabel = (replyTo: InquiryTimelineEntry['replyTo']) =>
    replyAuthorLabel(replyTo!, 'ADMIN');
  readonly replyTargetAuthorLabel = (target: ChatReplyTarget) =>
    replyTargetAuthorLabel(target, 'ADMIN');
  readonly replyTargetLabel = replyTargetLabel;
  readonly shouldShowBubbleReply = shouldShowBubbleReply;
  readonly isTimelineNotice = isTimelineNotice;
  readonly noticeDisplayLabel = (entry: InquiryTimelineEntry) =>
    noticeDisplayLabel(entry, 'ADMIN');
  readonly noticeDisplayDetail = (entry: InquiryTimelineEntry) =>
    noticeDisplayDetail(entry, 'ADMIN');
  readonly getRequestSourceLabel = getRequestSourceLabel;

  readonly messageFieldLabel = computed(() => {
    const distributor = this.selectedDistributor();
    return distributor
      ? `Message to ${this.distributorLabel(distributor)}`
      : 'Message to distributor';
  });

  readonly messagePlaceholder = computed(() => {
    const distributor = this.selectedDistributor();
    return distributor
      ? `Type your message to ${this.distributorLabel(distributor)}…`
      : 'Type your message…';
  });

  ngOnInit(): void {
    const inquiryId = this.route.snapshot.paramMap.get('inquiryId');
    if (!inquiryId) {
      this.errorMessage.set('Missing inquiry reference.');
      this.loading.set(false);
      return;
    }
    this.loadInquiry(inquiryId);
  }

  ngOnDestroy(): void {
    this.cleanupRecordingResources(false);
    this.clearPendingAttachments();
  }

  loadInquiry(inquiryId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getById(inquiryId).subscribe({
      next: (inquiry) => {
        this.inquiry.set(inquiry);
        this.loading.set(false);
        this.syncDistributorSelection();
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load this quotation request.');
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.syncDistributorSelection();
  }

  selectDistributor(companyId: string): void {
    this.cancelVoiceRecording();
    this.clearPendingAttachments();
    this.selectedDistributorCompanyId.set(companyId);
    this.messageError.set(null);
    this.messageText.set('');
    this.clearReplyTarget();
    this.timelineEntries.set([]);
    this.loadTimeline();
  }

  private syncDistributorSelection(): void {
    const visible = this.filteredDistributors();
    const current = this.selectedDistributorCompanyId();
    if (current != null && visible.some((d) => d.companyId === current)) {
      return;
    }
    this.clearPendingAttachments();
    const nextId = visible[0]?.companyId ?? null;
    this.selectedDistributorCompanyId.set(nextId);
    if (nextId) {
      this.loadTimeline();
    } else {
      this.timelineEntries.set([]);
    }
  }

  loadTimeline(options?: { silent?: boolean; scrollToBottom?: boolean; preserveScroll?: boolean }): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry || !distributorCompanyId) {
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

    this.inquiryService.getDistributorChannelTimeline(inquiry.id, distributorCompanyId).subscribe({
      next: (timeline) => {
        this.timelineEntries.set(timeline.entries ?? []);
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        this.inquiry.update((current) =>
          current
            ? {
                ...current,
                status: timeline.currentStatus ?? current.status,
                needsClarification: timeline.needsClarification ?? current.needsClarification,
              }
            : current,
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
          this.timelineError.set('Could not load distributor messages.');
        }
      },
    });
  }

  sendMessage(): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    const message = this.messageText().trim();
    const attachments = this.pendingAttachments().map((item) => item.file);
    const replyToMessageId = this.replyTarget()?.attachment ? undefined : this.replyTarget()?.entry.id;
    const replyToAttachmentId = this.replyTarget()?.attachment?.id;

    if (!inquiry || !distributorCompanyId || (!message && attachments.length === 0)) {
      this.messageError.set('Enter a message or attach a file before sending.');
      return;
    }

    this.messageLoading.set(true);
    this.messageError.set(null);

    const request =
      attachments.length > 0
        ? this.inquiryService.postDistributorMessageWithAttachments(
            inquiry.id,
            distributorCompanyId,
            message,
            attachments,
            replyToMessageId,
            replyToAttachmentId,
          )
        : this.inquiryService.postDistributorMessage(
            inquiry.id,
            distributorCompanyId,
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
        this.inquiry.set(updated);
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

  canMessage(inquiry: Inquiry): boolean {
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
    this.loadTimeline({ silent: true, scrollToBottom: true });
  }

  refreshMessages(): void {
    this.loadTimeline({ silent: true, preserveScroll: true });
  }

  lineSourceLabel(lineSource?: string): string {
    return lineSource === 'NEW_PRODUCT' ? 'New product from search' : 'Catalog match';
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

  distributorLabel(distributor: InquiryDistributor): string {
    return distributor.companyName ?? 'Distributor';
  }

  distributorStatusLabel(distributor: InquiryDistributor): string {
    return distributor.responseReceived ? 'Responded' : 'Pending response';
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
}
