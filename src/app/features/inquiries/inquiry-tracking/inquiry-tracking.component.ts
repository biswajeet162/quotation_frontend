import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConsumerInquiry, Inquiry, InquiryStatus } from '../../../core/models/inquiry.model';
import {
  InquiryTimelineEntry,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { InquiryWorkflowDialogComponent } from '../../../shared/components/inquiry-workflow-dialog/inquiry-workflow-dialog.component';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  getConsumerInquiryDisplay,
  getRequestSourceLabel,
} from '../../../shared/utils/inquiry-display.util';

type StatusFilter = 'all' | InquiryStatus | 'ACTION_REQUIRED';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: TimelineAttachmentMediaType;
}

@Component({
  selector: 'app-inquiry-tracking',
  imports: [FormsModule, InquiryWorkflowDialogComponent, InquiryChatAttachmentComponent],
  templateUrl: './inquiry-tracking.component.html',
  styleUrl: './inquiry-tracking.component.css',
})
export class InquiryTrackingComponent implements OnInit {
  private readonly inquiryService = inject(InquiryService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiries = signal<ConsumerInquiry[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly selectedId = signal<string | null>(null);

  readonly timelineLoading = signal(false);
  readonly timelineError = signal<string | null>(null);
  readonly timelineEntries = signal<InquiryTimelineEntry[]>([]);

  readonly messageText = signal('');
  readonly messageLoading = signal(false);
  readonly messageError = signal<string | null>(null);
  readonly pendingAttachments = signal<PendingAttachment[]>([]);
  readonly recording = signal(false);

  readonly deleteLoading = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly deleteConfirmOpen = signal(false);
  readonly workflowOpen = signal(false);

  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'NEW', label: 'New / submitted' },
    { value: 'ACTION_REQUIRED', label: 'Action required' },
    { value: 'SENT_TO_DISTRIBUTORS', label: 'With distributors' },
    { value: 'RESPONSES_RECEIVED', label: 'Responses received' },
    { value: 'FINAL_SENT', label: 'Quotation ready' },
    { value: 'CLOSED', label: 'Closed' },
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
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  readonly selectedInquiry = computed(() => {
    const id = this.selectedId();
    if (id == null) {
      return null;
    }
    return this.inquiries().find((q) => q.id === id) ?? null;
  });

  readonly chatMessages = computed(() =>
    this.timelineEntries().filter((entry) => entry.kind === 'MESSAGE'),
  );

  readonly canSendMessage = computed(
    () => this.messageText().trim().length > 0 || this.pendingAttachments().length > 0,
  );

  readonly getRequestSourceLabel = getRequestSourceLabel;
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
    if (this.workflowOpen()) {
      this.closeWorkflow();
    } else if (this.deleteConfirmOpen()) {
      this.closeDeleteConfirm();
    }
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getMyInquiries().subscribe({
      next: (list) => {
        this.inquiries.set(list);
        this.loading.set(false);
        const current = this.selectedId();
        const stillVisible =
          current != null && this.filteredInquiries().some((q) => q.id === current);
        if (!stillVisible) {
          const first = this.filteredInquiries()[0];
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

  selectInquiry(id: string): void {
    this.clearPendingAttachments();
    this.stopVoiceRecording();
    this.selectedId.set(id);
    this.deleteError.set(null);
    this.messageError.set(null);
    this.messageText.set('');
    this.loadTimeline();
  }

  private syncSelection(): void {
    const visible = this.filteredInquiries();
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

  loadTimeline(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    this.timelineLoading.set(true);
    this.timelineError.set(null);

    this.inquiryService.getTimeline(inquiry.id).subscribe({
      next: (timeline) => {
        this.timelineEntries.set(timeline.entries);
        this.timelineLoading.set(false);
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
      },
      error: () => {
        this.timelineLoading.set(false);
        this.timelineError.set('Could not load messages.');
      },
    });
  }

  sendMessage(): void {
    const inquiry = this.selectedInquiry();
    const message = this.messageText().trim();
    const attachments = this.pendingAttachments().map((item) => item.file);

    if (!inquiry || (!message && attachments.length === 0)) {
      this.messageError.set('Enter a message or attach a file before sending.');
      return;
    }

    this.messageLoading.set(true);
    this.messageError.set(null);

    const request =
      attachments.length > 0
        ? this.inquiryService.postMessageWithAttachments(inquiry.id, message, attachments)
        : this.inquiryService.postMessage(inquiry.id, message);

    request.subscribe({
      next: (updated) => {
        this.messageLoading.set(false);
        this.messageText.set('');
        this.clearPendingAttachments();
        this.inquiries.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
        this.loadTimeline();
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

  private onFilesSelectedWithType(event: Event, expected: TimelineAttachmentMediaType): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }

    for (const file of Array.from(files)) {
      const mediaType = this.resolveMediaType(file);
      if (mediaType !== expected) {
        this.messageError.set(
          expected === 'IMAGE' ? 'Please choose an image file.' : 'Please choose a video file.',
        );
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
      this.recordingChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (this.recordingChunks.length === 0) {
          return;
        }
        const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        this.addPendingFile(file);
        this.recordingChunks = [];
      };
      this.mediaRecorder.start();
      this.recording.set(true);
      this.messageError.set(null);
    } catch {
      this.messageError.set('Microphone access was denied or unavailable.');
    }
  }

  stopVoiceRecording(): void {
    if (this.mediaRecorder && this.recording()) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
      this.recording.set(false);
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

  canMessage(inquiry: ConsumerInquiry): boolean {
    return inquiry.status !== 'CLOSED';
  }

  canDelete(inquiry: ConsumerInquiry): boolean {
    return inquiry.status === 'NEW';
  }

  openWorkflow(): void {
    if (this.selectedInquiry()) {
      this.workflowOpen.set(true);
    }
  }

  closeWorkflow(): void {
    this.workflowOpen.set(false);
  }

  onWorkflowRefreshed(): void {
    this.load();
  }

  workflowInquiry(inquiry: ConsumerInquiry): Inquiry {
    const user = this.auth.currentUser();
    return {
      id: inquiry.id,
      inquiryId: inquiry.inquiryId,
      companyId: user?.companyId ?? '',
      companyName: user?.companyName,
      title: inquiry.title,
      description: inquiry.description,
      status: inquiry.status,
      needsClarification: inquiry.needsClarification,
      clarificationMessage: inquiry.clarificationMessage,
      requestSource: inquiry.requestSource,
      searchTerm: inquiry.searchTerm,
      items: inquiry.items,
      createdAt: inquiry.createdAt,
      updatedAt: inquiry.updatedAt,
    };
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

  private addPendingFile(file: File): void {
    const mediaType = this.resolveMediaType(file);
    if (!mediaType) {
      this.messageError.set('Unsupported file type. Use image, video, or audio.');
      return;
    }

    const previewUrl = mediaType === 'IMAGE' ? URL.createObjectURL(file) : undefined;
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
    if (/\.(mp4|webm|mov)$/.test(lower)) {
      return 'VIDEO';
    }
    if (/\.(mp3|wav|ogg|m4a|webm)$/.test(lower)) {
      return 'AUDIO';
    }
    return null;
  }

  private clearPendingAttachments(): void {
    for (const item of this.pendingAttachments()) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }
    this.pendingAttachments.set([]);
  }
}
