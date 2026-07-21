import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BrandRoutingPreview,
  DistributorOption,
  Inquiry,
  InquiryItem,
  InquiryStatus,
} from '../../../core/models/inquiry.model';
import {
  InquiryTimelineAttachment,
  InquiryTimelineEntry,
  InquiryTimelineReplyTo,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { ChatAudioPlayerComponent } from '../../../shared/components/chat-audio-player/chat-audio-player.component';
import {
  formatExpectedDeliveryDate,
  getInquiryListStep,
} from '../../../shared/utils/inquiry-display.util';
import { quotationLinePricingFromAdmin } from '../../../shared/utils/inquiry-pricing.util';
import {
  canReplyToTimelineEntry,
  ChatReplyTarget,
  quotedMessageElementId,
  replyAuthorLabel as buildReplyAuthorLabel,
  replyTargetAuthorLabel as buildReplyTargetAuthorLabel,
  replyTargetLabel,
  shouldShowBubbleReply,
} from '../../../shared/utils/chat-reply.util';
import {
  buildAdminCustomerChatTimelineEntries,
  isFinalQuotationNotice,
  isTimelineNotice,
  noticeDisplayDetail,
  noticeDisplayLabel,
} from '../../../shared/utils/timeline-chat.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { openPublicImages } from '../../../shared/utils/public-image.util';

type StatusFilter = 'all' | InquiryStatus | 'ACTION_REQUIRED';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: TimelineAttachmentMediaType;
}

interface AdminInquiryLineDraft {
  hsnCode?: string;
  description?: string;
  mrp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  expectedDeliveryDate?: string;
}

interface DistributorSendPricingSnapshot {
  lineDrafts: Record<string, AdminInquiryLineDraft>;
}

@Component({
  selector: 'app-admin-query-review',
  imports: [FormsModule, InquiryChatAttachmentComponent, ChatAudioPlayerComponent, LoadingOverlayComponent],
  templateUrl: './admin-query-review.component.html',
  styleUrl: './admin-query-review.component.css',
})
export class AdminQueryReviewComponent implements OnInit, OnDestroy {
  private readonly inquiryService = inject(InquiryService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly inquiries = signal<Inquiry[]>([]);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly selectedId = signal<string | null>(null);
  readonly actionLoading = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly markAwaitingConsumer = signal(true);

  readonly distributorPickerOpen = signal(false);
  readonly distributorOptionsLoading = signal(false);
  readonly distributorOptionsError = signal<string | null>(null);
  readonly brandRoutingPreview = signal<BrandRoutingPreview | null>(null);
  readonly showMatchedDistributors = signal(false);

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

  readonly chatModalOpen = signal(false);
  readonly chatModalPosition = signal<{ x: number; y: number } | null>(null);
  readonly chatModalSize = signal<{ width: number; height: number } | null>(null);
  readonly quotationPdfViewerOpen = signal(false);
  readonly quotationPdfSafeUrl = signal<SafeResourceUrl | null>(null);
  readonly quotationPdfViewerFileName = signal('');
  readonly lineDrafts = signal<Map<string, AdminInquiryLineDraft>>(new Map());
  readonly distributorSendSnapshots = signal<Map<string, DistributorSendPricingSnapshot>>(new Map());

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
        inquiry.companyName,
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

  readonly selectedInquiry = computed(() => {
    const id = this.selectedId();
    if (id == null) {
      return null;
    }
    return this.inquiries().find((q) => q.id === id) ?? null;
  });

  readonly selectedDistributorCount = computed(
    () => this.brandRoutingPreview()?.matchedDistributorCount ?? 0,
  );

  readonly matchedDistributorOptions = computed(
    () => this.brandRoutingPreview()?.distributors ?? [],
  );

  readonly uncoveredBrands = computed(() => this.brandRoutingPreview()?.uncoveredBrands ?? []);

  readonly chatTimelineEntries = computed(() =>
    buildAdminCustomerChatTimelineEntries(this.timelineEntries()),
  );

  readonly canSendMessage = computed(
    () => this.messageText().trim().length > 0 || this.pendingAttachments().length > 0,
  );

  readonly canReplyTo = canReplyToTimelineEntry;
  readonly replyTargetLabel = replyTargetLabel;
  readonly shouldShowBubbleReply = shouldShowBubbleReply;
  readonly isTimelineNotice = isTimelineNotice;
  readonly noticeDisplayLabel = (entry: InquiryTimelineEntry) =>
    noticeDisplayLabel(entry, 'ADMIN');
  readonly noticeDisplayDetail = (entry: InquiryTimelineEntry) =>
    noticeDisplayDetail(entry, 'ADMIN');
  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;
  readonly getInquiryListStep = getInquiryListStep;

  assignedDistributorCount(inquiry: Inquiry): number {
    return inquiry.distributors?.length ?? 0;
  }

  hasSentToDistributors(inquiry: Inquiry): boolean {
    return this.assignedDistributorCount(inquiry) > 0;
  }

  sentToDistributorsTitle(inquiry: Inquiry): string {
    const count = this.assignedDistributorCount(inquiry);
    const countLabel = count === 1 ? '1 distributor' : `${count} distributors`;
    return `The quotation request has been sent to ${countLabel}:`;
  }

  sentDistributorLines(
    inquiry: Inquiry,
  ): { id: string; index: number; label: string }[] {
    return (inquiry.distributors ?? []).map((distributor, index) => {
      const name = distributor.companyName?.trim() || 'Distributor';
      const email = distributor.email?.trim() || '—';
      const brands =
        (distributor.matchedBrands ?? []).length > 0
          ? (distributor.matchedBrands ?? []).join(', ')
          : null;
      const status = distributor.responseReceived
        ? 'Responded'
        : distributor.emailSent
          ? 'Awaiting response'
          : 'Queued';
      const itemNote =
        distributor.assignedItemCount != null && distributor.assignedItemCount > 0
          ? `${distributor.assignedItemCount} line${distributor.assignedItemCount === 1 ? '' : 's'}`
          : null;
      const details = [brands ? `brands: ${brands}` : null, itemNote, status]
        .filter(Boolean)
        .join(' · ');
      return {
        id: distributor.id ?? distributor.companyId ?? `${index}`,
        index: index + 1,
        label: `${name} (${email})${details ? ` — ${details}` : ''}`,
      };
    });
  }

  sentToDistributorsAt(inquiry: Inquiry): string | undefined {
    const sentTimes = (inquiry.distributors ?? [])
      .map((d) => d.emailSentAt)
      .filter((value): value is string => !!value)
      .map((value) => new Date(value).getTime())
      .filter((time) => !Number.isNaN(time));

    const timelineTimes = this.timelineEntries()
      .filter(
        (entry) =>
          entry.noticeCode === 'SENT_TO_DISTRIBUTOR' ||
          entry.noticeCode === 'SENT_TO_DISTRIBUTORS' ||
          (entry.kind === 'MILESTONE' && entry.title === 'Sent to distributors'),
      )
      .map((entry) => new Date(entry.occurredAt).getTime())
      .filter((time) => !Number.isNaN(time));

    const allTimes = [...sentTimes, ...timelineTimes];
    if (allTimes.length > 0) {
      return new Date(Math.min(...allTimes)).toISOString();
    }

    return inquiry.updatedAt ?? inquiry.createdAt;
  }

  hasFinalPricingLine(item: InquiryItem): boolean {
    return item.adminMrp != null;
  }

  finalLineAmount(item: InquiryItem): number | null {
    return quotationLinePricingFromAdmin(item).amount;
  }

  finalLineNetValue(item: InquiryItem): number | null {
    return quotationLinePricingFromAdmin(item).netValue;
  }

  hasFinalQuotationSharedWithConsumer(inquiry: Inquiry): boolean {
    return (
      inquiry.status === 'FINAL_SENT' ||
      this.timelineEntries().some((entry) => isFinalQuotationNotice(entry))
    );
  }

  finalQuotationSharedAt(inquiry: Inquiry): string | undefined {
    const entries = this.timelineEntries().filter((entry) => isFinalQuotationNotice(entry));
    return entries.at(-1)?.occurredAt ?? inquiry.updatedAt;
  }

  finalSharedQuotationPdfFileName(inquiry: Inquiry): string {
    return `${inquiry.inquiryId}-final-quotation.pdf`;
  }

  openFinalSharedQuotationPdf(inquiry: Inquiry): void {
    const attachment = this.timelineEntries()
      .filter((entry) => isFinalQuotationNotice(entry))
      .flatMap((entry) =>
        (entry.attachments ?? []).filter((item) => item.mediaType === 'DOCUMENT'),
      )
      .at(-1);

    if (attachment) {
      this.inquiryService.fetchAttachmentBlob(attachment.url).subscribe({
        next: (blob) => {
          this.openPdfInViewer(
            blob,
            attachment.contentType || 'application/pdf',
            attachment.fileName || this.finalSharedQuotationPdfFileName(inquiry),
          );
        },
        error: () => {
          this.openAdminRfqPdf(inquiry);
        },
      });
      return;
    }

    this.openAdminRfqPdf(inquiry);
  }

  formatOptionalNumber(value: number | null | undefined): string {
    return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatOptionalPercent(value: number | null | undefined): string {
    return value == null ? '—' : `${value}`;
  }

  sentLineAmount(item: InquiryItem): number | null {
    return quotationLinePricingFromAdmin(item).amount;
  }

  sentLineNetValue(item: InquiryItem): number | null {
    return quotationLinePricingFromAdmin(item).netValue;
  }

  openDistributorChats(inquiryId: string): void {
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/admin/queries', inquiryId, 'distributors']),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  readonly messageFieldLabel = computed(() => 'Message to consumer');
  readonly messagePlaceholder = computed(() => 'Type your message to the consumer…');

  readonly replyAuthorLabel = (replyTo: InquiryTimelineReplyTo) =>
    buildReplyAuthorLabel(replyTo, 'ADMIN');

  readonly replyTargetAuthorLabel = (target: ChatReplyTarget) =>
    buildReplyTargetAuthorLabel(target, 'ADMIN');

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
    if (this.distributorPickerOpen()) {
      this.closeDistributorPicker();
    }
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('finalized') === '1') {
        this.successMessage.set('Quotation request has been sent to the customer.');
        this.toast.success('Quotation request has been sent to the customer.');
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { finalized: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.cleanupRecordingResources(false);
    this.closeQuotationPdfViewer();
  }

  load(): void {
    const requestedInquiryRef = this.route.snapshot.queryParamMap.get('inq')?.trim() ?? null;
    if (requestedInquiryRef && this.inquiries().length > 0) {
      const current = this.selectedInquiry();
      if (current?.inquiryId === requestedInquiryRef) {
        return;
      }
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getAll().subscribe({
      next: (list) => {
        this.inquiries.set(list);
        this.loading.set(false);

        if (requestedInquiryRef) {
          const match = list.find((inquiry) => inquiry.inquiryId === requestedInquiryRef);
          if (match) {
            this.searchQuery.set('');
            this.statusFilter.set('all');
            this.selectedId.set(match.id);
            this.hydrateLineDraftsFromInquiry(match);
            this.markAwaitingConsumer.set(match.status === 'NEW');
            this.loadTimeline();
            return;
          }
          this.selectedId.set(null);
          this.timelineEntries.set([]);
          this.errorMessage.set('No such inquiry exists.');
          this.toast.warning('No such inquiry exists.');
          return;
        }

        const current = this.selectedId();
        const stillVisible =
          current != null && this.filteredInquiries().some((q) => q.id === current);
        if (!stillVisible) {
          this.syncSelection();
        } else if (this.selectedId()) {
          this.loadTimeline();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load consumer queries.');
        this.toast.fromApiError(err, 'Could not load consumer queries.');
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

  private syncSelection(): void {
    const visible = this.filteredInquiries();
    const current = this.selectedId();
    if (current != null && visible.some((q) => q.id === current)) {
      return;
    }
    this.clearPendingAttachments();
    this.selectedId.set(visible[0]?.id ?? null);
    if (this.selectedId()) {
      const inquiry = this.inquiries().find((q) => q.id === this.selectedId());
      this.markAwaitingConsumer.set(inquiry?.status === 'NEW');
      this.loadTimeline();
    } else {
      this.timelineEntries.set([]);
    }
  }

  selectInquiry(id: string): void {
    this.cancelVoiceRecording();
    this.clearPendingAttachments();
    this.closeChatModal();
    this.selectedId.set(id);
    this.actionError.set(null);
    this.messageError.set(null);
    this.messageText.set('');
    this.clearReplyTarget();
    this.timelineEntries.set([]);

    const inquiry = this.inquiries().find((q) => q.id === id);
    if (inquiry) {
      this.hydrateLineDraftsFromInquiry(inquiry);
    }
    this.markAwaitingConsumer.set(inquiry?.status === 'NEW');
    this.loadTimeline();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: inquiry ? { inq: inquiry.inquiryId } : { inq: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  loadTimeline(options?: { silent?: boolean; scrollToBottom?: boolean; preserveScroll?: boolean }): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    const scrollEl = this.chatModalOpen()
      ? this.chatScrollRef()?.nativeElement
      : this.detailScrollRef()?.nativeElement;
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

        if (options?.scrollToBottom) {
          this.scrollChatToBottom();
          this.focusComposeInput();
        } else if (options?.preserveScroll && scrollEl) {
          scrollEl.scrollTop = previousScrollTop;
        }
      },
      error: (err) => {
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        if (!silent) {
          this.timelineError.set('Could not load messages.');
          this.toast.fromApiError(err, 'Could not load messages.');
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
    const markAwaiting =
      inquiry?.status === 'NEW' ? this.markAwaitingConsumer() : false;

    if (!inquiry || (!message && attachments.length === 0)) {
      this.messageError.set('Enter a message or attach a file before sending.');
      this.toast.warning('Enter a message or attach a file before sending.');
      return;
    }

    this.messageLoading.set(true);
    this.messageError.set(null);

    const request =
      attachments.length > 0
        ? this.inquiryService.postAdminMessageWithAttachments(
            inquiry.id,
            message,
            attachments,
            replyToMessageId,
            replyToAttachmentId,
            markAwaiting,
          )
        : this.inquiryService.postAdminMessage(
            inquiry.id,
            message,
            replyToMessageId,
            replyToAttachmentId,
            markAwaiting,
          );

    request.subscribe({
      next: (updated) => {
        this.messageLoading.set(false);
        this.messageText.set('');
        this.clearReplyTarget();
        this.clearPendingAttachments();
        this.replaceInquiry(updated);
        this.focusComposeInput();
        this.loadTimeline({ silent: true, scrollToBottom: true });
      },
      error: (err) => {
        this.messageLoading.set(false);
        this.messageError.set(err?.error?.message ?? 'Could not send your message.');
        this.toast.fromApiError(err, 'Could not send your message.');
      },
    });
  }

  sendToDistributors(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    this.distributorPickerOpen.set(true);
    this.distributorOptionsError.set(null);
    this.showMatchedDistributors.set(false);
    this.brandRoutingPreview.set(null);
    this.loadDistributorOptions(inquiry.id);
  }

  closeDistributorPicker(): void {
    if (this.actionLoading()) {
      return;
    }
    this.distributorPickerOpen.set(false);
    this.distributorOptionsError.set(null);
  }

  loadDistributorOptions(inquiryId: string): void {
    this.distributorOptionsLoading.set(true);
    this.distributorOptionsError.set(null);

    this.inquiryService.getDistributorOptions(inquiryId).subscribe({
      next: (preview) => {
        this.brandRoutingPreview.set(preview);
        this.distributorOptionsLoading.set(false);
        if (preview.matchedDistributorCount === 0) {
          this.distributorOptionsError.set(
            'No distributors carry the brands in this request. Update distributor catalogs before sending.',
          );
          this.toast.warning(
            'No distributors carry the brands in this request. Update distributor catalogs before sending.',
          );
        }
      },
      error: (err) => {
        this.distributorOptionsLoading.set(false);
        this.distributorOptionsError.set(
          err?.error?.message ?? 'Could not load brand routing preview.',
        );
        this.toast.fromApiError(err, 'Could not load brand routing preview.');
      },
    });
  }

  toggleMatchedDistributorsPreview(): void {
    this.showMatchedDistributors.update((open) => !open);
  }

  matchedBrandsLabel(option: DistributorOption): string {
    const brands = option.matchedBrands ?? [];
    return brands.length > 0 ? brands.join(', ') : '—';
  }

  isPercentageOverLimit(value?: number | null): boolean {
    return value != null && value > 100;
  }

  isPercentageFieldValid(value?: number | null): boolean {
    return value != null && value >= 0 && value <= 100;
  }

  canConfirmSendToDistributors(inquiry: Inquiry): boolean {
    if (this.distributorOptionsLoading()) {
      return false;
    }
    if ((this.brandRoutingPreview()?.matchedDistributorCount ?? 0) === 0) {
      return false;
    }
    return this.validateLinePricing(inquiry) == null;
  }

  confirmSendToDistributors(): void {
    const inquiry = this.selectedInquiry();
    if (!inquiry) {
      return;
    }

    if ((this.brandRoutingPreview()?.matchedDistributorCount ?? 0) === 0) {
      this.distributorOptionsError.set(
        'No distributors carry the brands in this request.',
      );
      this.toast.warning('No distributors carry the brands in this request.');
      return;
    }

    const pricingError = this.validateLinePricing(inquiry);
    if (pricingError) {
      this.distributorOptionsError.set(pricingError);
      this.toast.warning(pricingError);
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.distributorOptionsError.set(null);

    this.inquiryService
      .submitToDistributors(inquiry.id, this.buildLinePricingPayload(inquiry))
      .subscribe({
      next: (updated) => {
        this.captureDistributorSendSnapshot(inquiry);
        this.replaceInquiry(updated);
        this.actionLoading.set(false);
        this.distributorPickerOpen.set(false);
        this.loadTimeline({ silent: true, scrollToBottom: true });
        this.toast.success('Quotation request sent to distributors.');
        this.openDistributorChats(updated.id);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.distributorOptionsError.set(
          err?.error?.message ?? 'Could not send to distributors.',
        );
        this.toast.fromApiError(err, 'Could not send to distributors.');
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

  openSubmissionPdf(inquiry: Inquiry): void {
    this.inquiryService.downloadSubmissionPdf(inquiry.id).subscribe({
      next: (blob) => {
        this.openPdfInViewer(blob, 'application/pdf', this.submissionPdfFileName(inquiry));
      },
      error: (err) => {
        this.messageError.set('Could not open the request PDF.');
        this.toast.fromApiError(err, 'Could not open the request PDF.');
      },
    });
  }

  openAdminRfqPdf(inquiry: Inquiry): void {
    this.inquiryService.downloadAdminRfqPdf(inquiry.id).subscribe({
      next: (blob) => {
        this.openPdfInViewer(blob, 'application/pdf', this.adminRfqPdfFileName(inquiry));
      },
      error: (err) => {
        this.messageError.set('Could not open the RFQ PDF.');
        this.toast.fromApiError(err, 'Could not open the RFQ PDF.');
      },
    });
  }

  submissionPdfFileName(inquiry: Inquiry): string {
    return `${inquiry.inquiryId}.pdf`;
  }

  adminRfqPdfFileName(inquiry: Inquiry): string {
    return `${inquiry.inquiryId}-rfq.pdf`;
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

  productCountLabel(items?: Inquiry['items']): string {
    const count = items?.length ?? 0;
    return count === 1 ? '1 product' : `${count} products`;
  }

  totalItemQuantity(items?: Inquiry['items']): number {
    return (items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  }

  displayProductField(value?: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  lineDraftKey(inquiryId: string, item: InquiryItem): string {
    return `${inquiryId}:${item.id ?? item.productId}`;
  }

  getLineDraft(inquiryId: string, item: InquiryItem): AdminInquiryLineDraft {
    const key = this.lineDraftKey(inquiryId, item);
    const draft = this.lineDrafts().get(key);
    const persisted = this.lineDraftFromPersistedItem(item);
    if (!draft) {
      return persisted;
    }
    return { ...persisted, ...draft };
  }

  updateLineTextField(
    inquiryId: string,
    item: InquiryItem,
    field: 'hsnCode' | 'description',
    value: string,
  ): void {
    if (field === 'description') {
      this.patchLineDraft(inquiryId, item, { description: value });
      return;
    }
    const trimmed = value.trim();
    this.patchLineDraft(inquiryId, item, { [field]: trimmed || undefined });
  }

  updateLineDateField(inquiryId: string, item: InquiryItem, value: string): void {
    const trimmed = value.trim();
    this.patchLineDraft(inquiryId, item, { expectedDeliveryDate: trimmed || undefined });
  }

  updateLineNumberField(
    inquiryId: string,
    item: InquiryItem,
    field: 'mrp' | 'discountPercentage' | 'gstPercentage',
    value: string | number | null,
  ): void {
    let parsed = this.parseOptionalNumber(value);
    if (parsed != null && field === 'mrp' && parsed < 0) {
      parsed = 0;
    }
    this.patchLineDraft(inquiryId, item, { [field]: parsed ?? undefined });
  }

  lineAmount(inquiryId: string, item: InquiryItem, draft?: AdminInquiryLineDraft): number | null {
    const lineDraft = draft ?? this.getLineDraft(inquiryId, item);
    if (lineDraft.mrp == null) {
      return null;
    }

    const discount = lineDraft.discountPercentage ?? 0;
    const unitAfterDiscount = lineDraft.mrp * (1 - discount / 100);
    return unitAfterDiscount * item.quantity;
  }

  lineNetValue(inquiryId: string, item: InquiryItem, draft?: AdminInquiryLineDraft): number | null {
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

  itemAttachmentCount(item: InquiryItem): number {
    return item.attachments?.length ?? 0;
  }

  itemAttachmentLabel(item: InquiryItem): string {
    const count = this.itemAttachmentCount(item);
    return count === 1 ? '1 image' : `${count} images`;
  }

  openItemAttachments(item: InquiryItem, event: Event): void {
    event.stopPropagation();
    const firstId = item.attachments?.[0]?.id;
    if (firstId) {
      openPublicImages(firstId);
    }
  }

  private patchLineDraft(
    inquiryId: string,
    item: InquiryItem,
    patch: Partial<AdminInquiryLineDraft>,
  ): void {
    const key = this.lineDraftKey(inquiryId, item);
    this.lineDrafts.update((drafts) => {
      const next = new Map(drafts);
      next.set(key, { ...(next.get(key) ?? {}), ...patch });
      return next;
    });
  }

  private captureDistributorSendSnapshot(inquiry: Inquiry): void {
    const lineDrafts: Record<string, AdminInquiryLineDraft> = {};
    for (const item of inquiry.items ?? []) {
      const key = this.lineDraftKey(inquiry.id, item);
      lineDrafts[key] = { ...this.getLineDraft(inquiry.id, item) };
    }

    this.distributorSendSnapshots.update((snapshots) => {
      const next = new Map(snapshots);
      next.set(inquiry.id, { lineDrafts });
      return next;
    });
  }

  private validateLinePricing(inquiry: Inquiry): string | null {
    for (const item of inquiry.items ?? []) {
      const draft = this.getLineDraft(inquiry.id, item);
      const label = [item.productBrand, item.productName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' · ');
      const productLabel = label || 'a product line';

      if (draft.mrp != null && draft.mrp < 0) {
        return `MRP cannot be negative for ${productLabel}.`;
      }
      if (draft.discountPercentage != null && (draft.discountPercentage < 0 || draft.discountPercentage > 100)) {
        return `Discount % must be between 0 and 100 for ${productLabel}.`;
      }
      if (draft.gstPercentage != null && (draft.gstPercentage < 0 || draft.gstPercentage > 100)) {
        return `GST % must be between 0 and 100 for ${productLabel}.`;
      }
    }
    return null;
  }

  private buildLinePricingPayload(inquiry: Inquiry) {
    return (inquiry.items ?? [])
      .filter((item) => item.id)
      .map((item) => {
        const draft = this.getLineDraft(inquiry.id, item);
        if (!this.hasLineDraftValues(draft)) {
          return null;
        }
        return {
          inquiryItemId: item.id!,
          hsnCode: draft.hsnCode,
          description: draft.description?.trim() ?? '',
          mrp: draft.mrp,
          discountPercentage: draft.discountPercentage,
          gstPercentage: draft.gstPercentage,
          expectedDeliveryDate: draft.expectedDeliveryDate,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line != null);
  }

  private lineDraftFromPersistedItem(item: InquiryItem): AdminInquiryLineDraft {
    return {
      hsnCode: item.adminHsnCode,
      description: item.productDescription,
      mrp: item.adminMrp,
      discountPercentage: item.adminDiscountPercentage,
      gstPercentage: item.adminGstPercentage,
      expectedDeliveryDate: this.toDateInputValue(item.expectedDeliveryDate),
    };
  }

  private hasLineDraftValues(draft: AdminInquiryLineDraft): boolean {
    return (
      !!draft.hsnCode?.trim() ||
      !!draft.description?.trim() ||
      draft.mrp != null ||
      draft.discountPercentage != null ||
      draft.gstPercentage != null ||
      !!draft.expectedDeliveryDate?.trim()
    );
  }

  private hydrateLineDraftsFromInquiry(inquiry: Inquiry): void {
    for (const item of inquiry.items ?? []) {
      const persisted = this.lineDraftFromPersistedItem(item);
      if (!this.hasLineDraftValues(persisted)) {
        continue;
      }
      this.patchLineDraft(inquiry.id, item, persisted);
    }
  }

  private toDateInputValue(value?: string): string | undefined {
    if (!value?.trim()) {
      return undefined;
    }
    // Accept ISO timestamps or yyyy-MM-dd from API.
    return value.trim().slice(0, 10);
  }

  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === '' || value == null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

  private replaceInquiry(updated: Inquiry): void {
    this.inquiries.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
    this.hydrateLineDraftsFromInquiry(updated);
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

  private scrollChatToBottom(): void {
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
