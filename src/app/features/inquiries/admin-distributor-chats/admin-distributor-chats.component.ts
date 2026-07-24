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
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Inquiry, InquiryDistributor, InquiryItem, DistributorQuotationHistoryEntry, InquiryFinalizationSnapshot, InquiryFinalizationSnapshotLine } from '../../../core/models/inquiry.model';
import { AdminCompanyProfile } from '../../../core/models/admin-company.model';
import {
  InquiryTimelineEntry,
  InquiryTimelineAttachment,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { AdminCompanyService } from '../../../core/services/admin/admin-company.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { ChatAudioPlayerComponent } from '../../../shared/components/chat-audio-player/chat-audio-player.component';
import { formatExpectedDeliveryDate, getRequestSourceLabel } from '../../../shared/utils/inquiry-display.util';
import {
  hasDistributorQuotationResponse,
  isDistributorLineUnavailable,
  quotationLinePricingFromAdmin,
  quotationLinePricingFromDistributor,
} from '../../../shared/utils/inquiry-pricing.util';
import {
  isBestRankedOffer,
  rankProductOffers,
} from '../../../shared/utils/product-offer-ranking.util';
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
  isDistributorQuotationNotice,
  isFinalQuotationForwardedNotice,
  isTimelineNotice,
  noticeDisplayDetail,
  noticeDisplayLabel,
} from '../../../shared/utils/timeline-chat.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import {
  buildQuoteChangeAlerts,
  distributorNeedsQuoteAction,
  productNeedsQuoteAction,
  quoteChangeDismissKey,
  QuoteChangeAlert,
} from '../../../shared/utils/quote-change-alert.util';
import { openPublicImages } from '../../../shared/utils/public-image.util';
import { QuotationComparisonModalComponent } from '../quotation-comparison-modal/quotation-comparison-modal.component';
import { FinalizeQuotationModalComponent } from '../finalize-quotation-modal/finalize-quotation-modal.component';

type ListViewMode = 'distributors' | 'products' | 'finalization';

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: TimelineAttachmentMediaType;
}

interface AdminInquiryLineDraft {
  hsnCode?: string;
  mrp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  ourDeliveryDate?: string;
}

interface ProductOfferQuote {
  companyId: string;
  companyName: string;
  unavailable: boolean;
  responseReceived: boolean;
  mrp: number | null;
  discountPercentage: number;
  gstPercentage: number;
  amount: number | null;
  netValue: number | null;
  deliveryDate?: string;
  isBestPrice: boolean;
}

interface ProductCompareSection {
  itemKey: string;
  item: InquiryItem;
  offers: ProductOfferQuote[];
  selectedCompanyId: string | null;
  quotedCount: number;
  unavailableCount: number;
  awaitingCount: number;
}

@Component({
  selector: 'app-admin-distributor-chats',
  imports: [
    FormsModule,
    InquiryChatAttachmentComponent,
    ChatAudioPlayerComponent,
    LoadingOverlayComponent,
    QuotationComparisonModalComponent,
    FinalizeQuotationModalComponent,
  ],
  templateUrl: './admin-distributor-chats.component.html',
  styleUrl: './admin-distributor-chats.component.css',
})
export class AdminDistributorChatsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inquiryService = inject(InquiryService);
  private readonly adminCompanyService = inject(AdminCompanyService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiry = signal<Inquiry | null>(null);
  readonly searchQuery = signal('');
  readonly selectedDistributorCompanyId = signal<string | null>(null);

  readonly companyDetailsOpen = signal(false);
  readonly companyDetailsLoading = signal(false);
  readonly companyDetailsError = signal<string | null>(null);
  readonly companyDetails = signal<AdminCompanyProfile | null>(null);
  readonly companyLogoPreviewUrl = signal<string | null>(null);
  private companyLogoObjectUrl: string | null = null;

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
  readonly quotationItems = signal<InquiryItem[]>([]);
  readonly quotationItemsLoading = signal(false);
  readonly quotationHistory = signal<DistributorQuotationHistoryEntry[]>([]);
  readonly quotationHistoryLoading = signal(false);
  readonly requoteLoading = signal(false);
  readonly comparisonModalOpen = signal(false);
  readonly finalizeModalOpen = signal(false);
  readonly mixFinalizeItems = signal<InquiryItem[]>([]);
  readonly mixDistributorByItemId = signal<Record<string, string>>({});
  readonly mixUnavailableItemIds = signal<string[]>([]);
  readonly finalizationHistory = signal<InquiryFinalizationSnapshot[]>([]);
  readonly finalizationLoading = signal(false);
  readonly finalizationError = signal<string | null>(null);
  /** Frontend-only: distributor chosen when finalizing (drives green + double-tick). */
  readonly finalChoiceCompanyId = signal<string | null>(null);

  /** Toggle between per-distributor chats and per-product quote picking. */
  readonly listViewMode = signal<ListViewMode>('distributors');
  readonly quotesByDistributor = signal<Map<string, InquiryItem[]>>(new Map());
  readonly productQuotesLoading = signal(false);
  readonly productQuotesError = signal<string | null>(null);
  /** itemKey → selected distributor companyId */
  readonly productSelections = signal<Map<string, string>>(new Map());

  private readonly detailScrollRef = viewChild<ElementRef<HTMLElement>>('detailScroll');
  private readonly chatScrollRef = viewChild<ElementRef<HTMLElement>>('chatScroll');
  private readonly messageInputRef = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');

  private quotationPdfViewerObjectUrl: string | null = null;
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

  readonly distributors = computed(() => {
    const list = this.inquiry()?.distributors ?? [];
    return [...list].sort((a, b) =>
      (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' }),
    );
  });

  readonly respondedDistributorCount = computed(
    () => this.distributors().filter((distributor) => distributor.responseReceived).length,
  );

  readonly canOpenComparison = computed(() => this.respondedDistributorCount() > 0);

  readonly canAskRequotation = computed(() => {
    const inquiry = this.inquiry();
    const distributor = this.selectedDistributor();
    if (!inquiry || inquiry.status === 'CLOSED' || !distributor) {
      return false;
    }
    if (distributor.requotationRequested && !distributor.responseReceived) {
      return false;
    }
    return (
      (!!distributor.responseReceived || this.hasPreviousDistributorQuotation()) &&
      this.canMessage(inquiry)
    );
  });

  readonly latestFinalization = computed(() => this.finalizationHistory()[0] ?? null);

  readonly quoteChangeAlerts = computed((): QuoteChangeAlert[] =>
    buildQuoteChangeAlerts(
      this.latestFinalization(),
      this.productCompareSections().map((section) => ({
        itemKey: section.itemKey,
        item: section.item,
        offers: section.offers.map((offer) => ({
          companyId: offer.companyId,
          companyName: offer.companyName,
          responseReceived: offer.responseReceived,
          unavailable: offer.unavailable,
          amount: offer.amount,
        })),
      })),
      this.distributors(),
    ),
  );

  readonly hasQuoteChangeAlerts = computed(() => this.quoteChangeAlerts().length > 0);

  readonly quoteChangeModalOpen = signal(false);

  readonly hasPreviousDistributorQuotation = computed(() =>
    this.quotationHistory().some((entry) => entry.type === 'QUOTATION') ||
    this.quotationItems().some((item) => this.hasQuotationLine(item)),
  );

  readonly latestQuotationHistoryRound = computed(() => {
    const rounds = this.quotationHistory()
      .filter((entry) => entry.type === 'QUOTATION')
      .map((entry) => entry.round ?? 0);
    return rounds.length ? Math.max(...rounds) : 0;
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

  readonly productCompareSections = computed((): ProductCompareSection[] => {
    const inquiry = this.inquiry();
    const items = inquiry?.items ?? [];
    const quotes = this.quotesByDistributor();
    const distributors = this.distributors();
    const selections = this.productSelections();
    if (!inquiry || items.length === 0) {
      return [];
    }

    return items.map((item) => {
      const itemKey = item.id ?? item.productId;
      const offers: ProductOfferQuote[] = [];

      for (const distributor of distributors) {
        const distributorItems = quotes.get(distributor.companyId);
        if (!distributorItems) {
          continue;
        }
        const quoteItem = distributorItems.find(
          (line) => (line.id ?? line.productId) === itemKey,
        );
        if (!quoteItem) {
          continue;
        }

        const unavailable = isDistributorLineUnavailable(quoteItem);
        const pricing = quotationLinePricingFromDistributor(quoteItem);
        offers.push({
          companyId: distributor.companyId,
          companyName: distributor.companyName?.trim() || 'Distributor',
          unavailable,
          responseReceived:
            !unavailable && !!distributor.responseReceived && pricing.mrp != null,
          mrp: unavailable ? null : pricing.mrp,
          discountPercentage: pricing.discountPercentage,
          gstPercentage: pricing.gstPercentage,
          amount: unavailable ? null : pricing.amount,
          netValue: unavailable ? null : pricing.netValue,
          deliveryDate: pricing.ourDeliveryDate,
          isBestPrice: false,
        });
      }

      // Ranking policy lives in product-offer-ranking.util.ts (swap rules there later).
      const rank = rankProductOffers(offers);
      const markedOffers = offers.map((offer) => ({
        ...offer,
        isBestPrice: isBestRankedOffer(offer.companyId, rank),
      }));

      markedOffers.sort((a, b) => {
        const rankValue = (offer: ProductOfferQuote) => {
          if (offer.responseReceived) {
            return 0;
          }
          if (offer.unavailable) {
            return 1;
          }
          return 2;
        };
        const aRank = rankValue(a);
        const bRank = rankValue(b);
        if (aRank !== bRank) {
          return aRank - bRank;
        }
        if (a.responseReceived && b.responseReceived) {
          const aRankIndex = rank.rankedCompanyIds.indexOf(a.companyId);
          const bRankIndex = rank.rankedCompanyIds.indexOf(b.companyId);
          if (aRankIndex >= 0 && bRankIndex >= 0 && aRankIndex !== bRankIndex) {
            return aRankIndex - bRankIndex;
          }
        }
        return a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' });
      });

      return {
        itemKey,
        item,
        offers: markedOffers,
        selectedCompanyId: selections.get(itemKey) ?? null,
        quotedCount: markedOffers.filter((offer) => offer.responseReceived).length,
        unavailableCount: markedOffers.filter((offer) => offer.unavailable).length,
        awaitingCount: markedOffers.filter((offer) => !offer.responseReceived && !offer.unavailable)
          .length,
      };
    });
  });

  readonly selectedProductCount = computed(
    () =>
      this.productCompareSections().filter((section) => section.selectedCompanyId != null).length,
  );

  /**
   * Per distributor: admin mix picks / products sent to that distributor.
   * Shown in the By distributors list from the start (e.g. 0/3, then 2/3 as picks are made).
   */
  readonly distributorPickRatios = computed(() => {
    const quotes = this.quotesByDistributor();
    const selections = this.productSelections();
    const inquiryItemCount = this.inquiry()?.items?.length ?? 0;
    const map = new Map<string, { selected: number; total: number }>();

    for (const distributor of this.distributors()) {
      const assignedItems = quotes.get(distributor.companyId) ?? [];
      const total =
        distributor.assignedItemCount != null && distributor.assignedItemCount > 0
          ? distributor.assignedItemCount
          : assignedItems.length > 0
            ? assignedItems.length
            : inquiryItemCount;

      if (total <= 0) {
        continue;
      }

      let selected = 0;
      for (const item of assignedItems) {
        const itemKey = item.id ?? item.productId;
        if (itemKey && selections.get(itemKey) === distributor.companyId) {
          selected += 1;
        }
      }
      map.set(distributor.companyId, { selected, total });
    }
    return map;
  });

  readonly productSelectionComplete = computed(() => {
    const sections = this.productCompareSections();
    if (sections.length === 0) {
      return false;
    }
    return sections.every((section) => section.selectedCompanyId != null);
  });

  readonly productSelectionTotalAmount = computed(() => {
    let total = 0;
    let hasValue = false;
    for (const section of this.productCompareSections()) {
      if (!section.selectedCompanyId) {
        continue;
      }
      const offer = section.offers.find(
        (row) => row.companyId === section.selectedCompanyId,
      );
      if (offer?.amount == null) {
        continue;
      }
      total += offer.amount;
      hasValue = true;
    }
    return hasValue ? total : null;
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
  readonly formatExpectedDeliveryDate = formatExpectedDeliveryDate;

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
      this.toast.warning('Missing inquiry reference.');
      this.loading.set(false);
      return;
    }
    this.loadInquiry(inquiryId);
  }

  ngOnDestroy(): void {
    this.cleanupRecordingResources(false);
    this.clearPendingAttachments();
    this.closeQuotationPdfViewer();
    this.closeCompanyDetails();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.companyDetailsOpen()) {
      this.closeCompanyDetails();
      return;
    }
    if (this.quotationPdfViewerOpen()) {
      this.closeQuotationPdfViewer();
      return;
    }
    if (this.chatModalOpen()) {
      this.closeChatModal();
    }
  }

  loadInquiry(inquiryId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getById(inquiryId).subscribe({
      next: (inquiry) => {
        if (this.inquiry()?.id !== inquiry.id) {
          this.finalChoiceCompanyId.set(null);
          this.productSelections.set(new Map());
          this.quotesByDistributor.set(new Map());
        }
        this.inquiry.set(inquiry);
        this.loading.set(false);
        this.syncDistributorSelection();
        this.resolveFinalChoiceOnLoad(inquiry);
        this.loadAllDistributorQuotes();
        if (inquiry.status === 'FINAL_SENT') {
          this.loadFinalizationHistory();
        } else {
          this.finalizationHistory.set([]);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set('Could not load this quotation request.');
        this.toast.fromApiError(err, 'Could not load this quotation request.');
      },
    });
  }

  setListViewMode(mode: ListViewMode): void {
    this.listViewMode.set(mode);
    if (mode === 'products' && this.quotesByDistributor().size === 0) {
      this.loadAllDistributorQuotes();
    }
    if (mode === 'finalization') {
      this.loadFinalizationHistory();
    }
  }

  refreshList(): void {
    const inquiry = this.inquiry();
    if (!inquiry) {
      return;
    }
    this.loadInquiry(inquiry.id);
    if (this.listViewMode() === 'products') {
      this.loadAllDistributorQuotes();
    }
    if (this.listViewMode() === 'finalization') {
      this.loadFinalizationHistory();
    }
  }

  canShowRequotationButton(distributor: InquiryDistributor): boolean {
    const inquiry = this.inquiry();
    if (!inquiry || inquiry.status === 'CLOSED') {
      return false;
    }
    return !!distributor.responseReceived || !!distributor.requotationRequested;
  }

  requotationButtonLabel(distributor: InquiryDistributor): string {
    if (distributor.requotationRequested && !distributor.responseReceived) {
      return 'Re-quotation pending';
    }
    return 'Ask for re-quotations';
  }

  isProductNeedingAction(itemKey: string): boolean {
    return productNeedsQuoteAction(itemKey, this.quoteChangeAlerts());
  }

  isDistributorNeedingAction(distributor: InquiryDistributor): boolean {
    return distributorNeedsQuoteAction(
      distributor.companyId,
      this.latestFinalization(),
      this.distributors(),
    );
  }

  openQuoteChangeModal(): void {
    this.quoteChangeModalOpen.set(true);
  }

  dismissQuoteChangeModal(): void {
    const inquiry = this.inquiry();
    const latest = this.latestFinalization();
    if (inquiry && latest) {
      sessionStorage.setItem(quoteChangeDismissKey(inquiry, latest), '1');
    }
    this.quoteChangeModalOpen.set(false);
  }

  openComparisonFromQuoteChangeAlert(): void {
    this.dismissQuoteChangeModal();
    this.openComparisonModal();
  }

  private maybeShowQuoteChangeModal(): void {
    if (this.finalizationLoading() || this.productQuotesLoading()) {
      return;
    }
    const inquiry = this.inquiry();
    const latest = this.latestFinalization();
    const alerts = this.quoteChangeAlerts();
    if (!inquiry || !latest || alerts.length === 0) {
      return;
    }
    if (sessionStorage.getItem(quoteChangeDismissKey(inquiry, latest)) === '1') {
      return;
    }
    this.quoteChangeModalOpen.set(true);
  }

  loadFinalizationHistory(): void {
    const inquiry = this.inquiry();
    if (!inquiry) {
      this.finalizationHistory.set([]);
      return;
    }

    this.finalizationLoading.set(true);
    this.finalizationError.set(null);
    this.inquiryService.getFinalizationHistory(inquiry.id).subscribe({
      next: (history) => {
        this.finalizationHistory.set(history ?? []);
        this.finalizationLoading.set(false);
        this.maybeShowQuoteChangeModal();
      },
      error: (err) => {
        this.finalizationHistory.set([]);
        this.finalizationLoading.set(false);
        this.finalizationError.set('Could not load finalization history.');
        this.toast.fromApiError(err, 'Could not load finalization history.');
      },
    });
  }

  hasSnapshotLine(line: InquiryFinalizationSnapshotLine): boolean {
    return line.adminMrp != null || line.adminAvailable === false;
  }

  isSnapshotLineUnavailable(line: InquiryFinalizationSnapshotLine): boolean {
    return line.adminAvailable === false;
  }

  snapshotLineAsItem(line: InquiryFinalizationSnapshotLine): InquiryItem {
    return {
      id: line.inquiryItemId,
      productId: line.productId ?? line.inquiryItemId ?? '',
      productName: line.productName,
      productBrand: line.productBrand,
      productDescription: line.productDescription,
      quantity: line.quantity,
      adminHsnCode: line.adminHsnCode,
      adminMrp: line.adminMrp,
      adminDiscountPercentage: line.adminDiscountPercentage,
      adminGstPercentage: line.adminGstPercentage,
      adminAvailable: line.adminAvailable,
      expectedDeliveryDate: line.expectedDeliveryDate,
    };
  }

  snapshotLineAmount(line: InquiryFinalizationSnapshotLine): number | null {
    return quotationLinePricingFromAdmin(this.snapshotLineAsItem(line)).amount;
  }

  snapshotLineNetValue(line: InquiryFinalizationSnapshotLine): number | null {
    return quotationLinePricingFromAdmin(this.snapshotLineAsItem(line)).netValue;
  }

  formatFinalizationDate(iso?: string): string {
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

  openFinalizationPdf(snapshot: InquiryFinalizationSnapshot): void {
    const attachment = snapshot.pdfAttachment;
    if (!attachment?.url) {
      this.toast.warning('No PDF is attached to this finalization.');
      return;
    }
    this.inquiryService.fetchAttachmentBlob(attachment.url).subscribe({
      next: (blob) => {
        this.openPdfInViewer(
          blob,
          attachment.contentType || 'application/pdf',
          attachment.fileName || 'final-quotation.pdf',
        );
      },
      error: (err) => {
        this.toast.fromApiError(err, 'Could not open the final quotation PDF.');
      },
    });
  }

  selectProductOffer(itemKey: string, companyId: string): void {
    this.productSelections.update((current) => {
      const next = new Map(current);
      next.set(itemKey, companyId);
      return next;
    });
  }

  clearProductOffer(itemKey: string): void {
    this.productSelections.update((current) => {
      const next = new Map(current);
      next.delete(itemKey);
      return next;
    });
  }

  isProductOfferSelected(itemKey: string, companyId: string): boolean {
    return this.productSelections().get(itemKey) === companyId;
  }

  selectedOfferLabel(section: ProductCompareSection): string {
    if (!section.selectedCompanyId) {
      return '—';
    }
    return (
      section.offers.find((offer) => offer.companyId === section.selectedCompanyId)?.companyName ??
      '—'
    );
  }

  selectBestOffersForAll(): void {
    const next = new Map<string, string>();
    for (const section of this.productCompareSections()) {
      const bestCompanyId =
        section.offers.find((offer) => offer.isBestPrice && offer.responseReceived)?.companyId ??
        null;
      if (bestCompanyId) {
        next.set(section.itemKey, bestCompanyId);
      }
    }
    this.productSelections.set(next);
  }

  jumpToDistributorFromOffer(companyId: string): void {
    this.listViewMode.set('distributors');
    this.selectDistributor(companyId);
  }

  /** Quoted rows that are not the current pick — kept visible with a red cancel strike. */
  isOfferCancelled(section: ProductCompareSection, offer: ProductOfferQuote): boolean {
    if (offer.unavailable) {
      return false;
    }
    if (!offer.responseReceived) {
      return false;
    }
    if (!section.selectedCompanyId) {
      return !offer.isBestPrice;
    }
    return section.selectedCompanyId !== offer.companyId;
  }

  /**
   * On By distributors tables: strike a line when another distributor won this product
   * in the by-products mix selection.
   */
  isDistributorItemCancelled(item: InquiryItem, distributorCompanyId?: string | null): boolean {
    if (this.isLineUnavailable(item)) {
      return false;
    }
    const companyId = distributorCompanyId ?? this.selectedDistributorCompanyId();
    if (!companyId) {
      return false;
    }
    const itemKey = item.id ?? item.productId;
    if (!itemKey) {
      return false;
    }
    const selectedCompanyId = this.productSelections().get(itemKey);
    if (!selectedCompanyId) {
      return false;
    }
    return selectedCompanyId !== companyId;
  }

  distributorPickRatio(distributor: InquiryDistributor): { selected: number; total: number } | null {
    return this.distributorPickRatios().get(distributor.companyId) ?? null;
  }

  private loadAllDistributorQuotes(): void {
    const inquiry = this.inquiry();
    const distributors = this.distributors();
    if (!inquiry || distributors.length === 0) {
      this.quotesByDistributor.set(new Map());
      return;
    }

    this.productQuotesLoading.set(true);
    this.productQuotesError.set(null);

    const requests = distributors.map((distributor) =>
      this.inquiryService.getDistributorQuotationItems(inquiry.id, distributor.companyId).pipe(
        catchError(() => of([] as InquiryItem[])),
      ),
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const map = new Map<string, InquiryItem[]>();
        distributors.forEach((distributor, index) => {
          map.set(distributor.companyId, results[index] ?? []);
        });
        this.quotesByDistributor.set(map);
        this.productQuotesLoading.set(false);
        // Default policy: auto-pick the ranked winner for every product.
        this.selectBestOffersForAll();
        this.maybeShowQuoteChangeModal();
      },
      error: (err) => {
        this.quotesByDistributor.set(new Map());
        this.productQuotesLoading.set(false);
        this.productQuotesError.set('Could not load distributor quotations by product.');
        this.toast.fromApiError(err, 'Could not load distributor quotations by product.');
      },
    });
  }

  /** Scan distributor timelines once so the chosen double-tick shows without selecting first. */
  private resolveFinalChoiceOnLoad(inquiry: Inquiry): void {
    if (this.finalChoiceCompanyId()) {
      return;
    }
    if (inquiry.status !== 'FINAL_SENT' && inquiry.status !== 'CLOSED') {
      return;
    }

    const distributors = inquiry.distributors ?? [];
    if (distributors.length === 0) {
      return;
    }

    forkJoin(
      distributors.map((distributor) =>
        this.inquiryService.getDistributorChannelTimeline(inquiry.id, distributor.companyId).pipe(
          map((timeline) => ({
            companyId: distributor.companyId,
            chosen: (timeline.entries ?? []).some((entry) => isFinalQuotationForwardedNotice(entry)),
          })),
          catchError(() => of({ companyId: distributor.companyId, chosen: false })),
        ),
      ),
    ).subscribe((results) => {
      if (this.inquiry()?.id !== inquiry.id) {
        return;
      }
      const chosen = results.find((result) => result.chosen);
      if (chosen) {
        this.finalChoiceCompanyId.set(chosen.companyId);
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.syncDistributorSelection();
  }

  openComparisonModal(): void {
    if (!this.canOpenComparison()) {
      return;
    }
    this.comparisonModalOpen.set(true);
  }

  closeComparisonModal(): void {
    this.comparisonModalOpen.set(false);
  }

  onComparisonSelectionsChange(selections: Map<string, string>): void {
    this.productSelections.set(new Map(selections));
  }

  onComparisonFinalizeRequested(selections: Map<string, string>): void {
    this.productSelections.set(new Map(selections));
    const mix = this.buildMixFinalizePayload(selections);
    if (mix.items.length === 0 && mix.unavailableItemIds.length === 0) {
      return;
    }
    if (mix.pricedItems.length === 0) {
      this.toast.warning('Pick at least one product before finalizing.');
      return;
    }
    this.mixFinalizeItems.set(mix.items);
    this.mixDistributorByItemId.set(mix.mixDistributorByItemId);
    this.mixUnavailableItemIds.set(mix.unavailableItemIds);
    this.comparisonModalOpen.set(false);
    this.finalizeModalOpen.set(true);
  }

  closeFinalizeModal(): void {
    this.finalizeModalOpen.set(false);
  }

  onQuotationFinalized(): void {
    this.finalizeModalOpen.set(false);
    const inquiryId = this.inquiry()?.id;
    if (inquiryId) {
      this.loadInquiry(inquiryId);
      this.loadAllDistributorQuotes();
      if (this.listViewMode() === 'finalization') {
        this.loadFinalizationHistory();
      }
    }
  }

  private buildMixFinalizePayload(selections: Map<string, string>): {
    items: InquiryItem[];
    pricedItems: InquiryItem[];
    mixDistributorByItemId: Record<string, string>;
    unavailableItemIds: string[];
  } {
    const inquiry = this.inquiry();
    const quotes = this.quotesByDistributor();
    const items: InquiryItem[] = [];
    const pricedItems: InquiryItem[] = [];
    const mixDistributorByItemId: Record<string, string> = {};
    const unavailableItemIds: string[] = [];
    if (!inquiry) {
      return { items, pricedItems, mixDistributorByItemId, unavailableItemIds };
    }

    for (const item of inquiry.items ?? []) {
      const itemKey = item.id ?? item.productId;
      if (!itemKey || !item.id) {
        continue;
      }
      const companyId = selections.get(itemKey);
      if (!companyId) {
        items.push({ ...item });
        unavailableItemIds.push(item.id);
        continue;
      }
      const quoteItem = (quotes.get(companyId) ?? []).find(
        (line) => (line.id ?? line.productId) === itemKey,
      );
      if (!quoteItem || quoteItem.distributorMrp == null) {
        items.push({ ...item });
        unavailableItemIds.push(item.id);
        continue;
      }
      const pricedItem: InquiryItem = {
        ...item,
        distributorHsnCode: quoteItem.distributorHsnCode,
        distributorMrp: quoteItem.distributorMrp,
        distributorDiscountPercentage: quoteItem.distributorDiscountPercentage,
        distributorGstPercentage: quoteItem.distributorGstPercentage,
        distributorOurDeliveryDate: quoteItem.distributorOurDeliveryDate,
      };
      items.push(pricedItem);
      pricedItems.push(pricedItem);
      mixDistributorByItemId[item.id] = companyId;
    }
    return { items, pricedItems, mixDistributorByItemId, unavailableItemIds };
  }

  askForRequotation(): void {
    const inquiry = this.inquiry();
    const distributor = this.selectedDistributor();
    if (!this.canAskRequotation() || !inquiry || !distributor) {
      return;
    }

    const note = `Hi ${this.distributorLabel(distributor)}, please review your quotation and submit a revised quote with updated pricing and delivery dates.`;
    this.requoteLoading.set(true);
    this.messageError.set(null);

    this.inquiryService.requestRequotation(inquiry.id, distributor.companyId, note).subscribe({
      next: (updated) => {
        this.inquiry.set(updated);
        this.requoteLoading.set(false);
        this.loadTimeline({ silent: true, scrollToBottom: true });
        this.loadQuotationItems();
        this.loadQuotationHistory();
        this.loadAllDistributorQuotes();
        this.toast.success('Re-quotation requested.');
      },
      error: (err) => {
        this.requoteLoading.set(false);
        this.messageError.set(
          err?.error?.message ?? 'Could not request a re-quotation from this distributor.',
        );
        this.toast.fromApiError(err, 'Could not request a re-quotation from this distributor.');
      },
    });
  }

  selectDistributor(companyId: string): void {
    this.cancelVoiceRecording();
    this.clearPendingAttachments();
    this.selectedDistributorCompanyId.set(companyId);
    this.messageError.set(null);
    this.messageText.set('');
    this.clearReplyTarget();
    this.timelineEntries.set([]);
    this.quotationItems.set([]);
    this.quotationHistory.set([]);
    this.loadTimeline();
    this.loadQuotationItems();
    this.loadQuotationHistory();
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
      this.loadQuotationItems();
      this.loadQuotationHistory();
    } else {
      this.timelineEntries.set([]);
      this.quotationItems.set([]);
      this.quotationHistory.set([]);
    }
  }

  private loadQuotationItems(): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry || !distributorCompanyId) {
      this.quotationItems.set([]);
      return;
    }

    this.quotationItemsLoading.set(true);
    this.inquiryService.getDistributorQuotationItems(inquiry.id, distributorCompanyId).subscribe({
      next: (items) => {
        this.quotationItems.set(items);
        this.quotationItemsLoading.set(false);
      },
      error: () => {
        this.quotationItems.set([]);
        this.quotationItemsLoading.set(false);
      },
    });
  }

  private loadQuotationHistory(): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry || !distributorCompanyId) {
      this.quotationHistory.set([]);
      return;
    }

    this.quotationHistoryLoading.set(true);
    this.inquiryService.getDistributorQuotationHistory(inquiry.id, distributorCompanyId).subscribe({
      next: (entries) => {
        this.quotationHistory.set(entries);
        this.quotationHistoryLoading.set(false);
      },
      error: () => {
        this.quotationHistory.set([]);
        this.quotationHistoryLoading.set(false);
      },
    });
  }

  loadTimeline(options?: { silent?: boolean; scrollToBottom?: boolean; preserveScroll?: boolean }): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry || !distributorCompanyId) {
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

    this.inquiryService.getDistributorChannelTimeline(inquiry.id, distributorCompanyId).subscribe({
      next: (timeline) => {
        const entries = timeline.entries ?? [];
        this.timelineEntries.set(entries);
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        if (entries.some((entry) => isFinalQuotationForwardedNotice(entry))) {
          this.finalChoiceCompanyId.set(distributorCompanyId);
        }
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
          this.scrollChatToBottom();
          this.focusComposeInput();
        } else if (options?.preserveScroll && scrollEl) {
          scrollEl.scrollTop = previousScrollTop;
        }
        this.loadQuotationItems();
        this.loadQuotationHistory();
      },
      error: (err) => {
        this.timelineLoading.set(false);
        this.timelineRefreshing.set(false);
        if (!silent) {
          this.timelineError.set('Could not load distributor messages.');
          this.toast.fromApiError(err, 'Could not load distributor messages.');
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
      this.toast.warning('Enter a message or attach a file before sending.');
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
        this.toast.fromApiError(err, 'Could not send your message.');
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
    this.detailScrollRef()?.nativeElement?.scrollTo({
      top: this.detailScrollRef()?.nativeElement.scrollHeight ?? 0,
      behavior: 'smooth',
    });
  }

  openChatModal(): void {
    if (!this.selectedDistributor()) {
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

  openCompanyDetails(companyId: string | null | undefined, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    const id = companyId?.trim();
    if (!id) {
      this.toast.warning('Company details are not available for this distributor.');
      return;
    }

    this.companyDetailsOpen.set(true);
    this.companyDetailsLoading.set(true);
    this.companyDetailsError.set(null);
    this.companyDetails.set(null);
    this.revokeCompanyLogoPreview();

    this.adminCompanyService.getProfile(id).subscribe({
      next: (profile) => {
        this.companyDetails.set(profile);
        this.companyDetailsLoading.set(false);
        if (profile.logoUrl) {
          this.loadCompanyLogoPreview(profile.id);
        }
      },
      error: (err) => {
        this.companyDetailsLoading.set(false);
        this.companyDetailsError.set('Could not load company details.');
        this.toast.fromApiError(err, 'Could not load company details.');
      },
    });
  }

  closeCompanyDetails(): void {
    this.companyDetailsOpen.set(false);
    this.companyDetailsLoading.set(false);
    this.companyDetailsError.set(null);
    this.companyDetails.set(null);
    this.revokeCompanyLogoPreview();
  }

  displayCompanyValue(value?: string | null): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  formatCompanyAddress(profile: AdminCompanyProfile): string {
    const parts = [profile.address, profile.city, profile.state, profile.country, profile.pinCode]
      .map((part) => part?.trim())
      .filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(', ') : '—';
  }

  private loadCompanyLogoPreview(companyId: string): void {
    this.adminCompanyService.loadProfileLogoBlob(companyId).subscribe({
      next: (blob) => {
        this.revokeCompanyLogoPreview();
        this.companyLogoObjectUrl = URL.createObjectURL(blob);
        this.companyLogoPreviewUrl.set(this.companyLogoObjectUrl);
      },
      error: () => this.revokeCompanyLogoPreview(),
    });
  }

  private revokeCompanyLogoPreview(): void {
    if (this.companyLogoObjectUrl) {
      URL.revokeObjectURL(this.companyLogoObjectUrl);
      this.companyLogoObjectUrl = null;
    }
    this.companyLogoPreviewUrl.set(null);
  }

  distributorStatusLabel(distributor: InquiryDistributor): string {
    if (this.isFinalChoiceDistributor(distributor)) {
      return 'Sent to consumer';
    }
    if (distributor.requotationRequested) {
      return 'Re-quote requested';
    }
    if (distributor.responseReceived) {
      const items = this.quotesByDistributor().get(distributor.companyId) ?? [];
      if (this.allQuotationItemsUnavailable(items)) {
        return 'No products available';
      }
      return 'Responded';
    }
    return 'Pending response';
  }

  allQuotationItemsUnavailable(items: InquiryItem[]): boolean {
    if (items.length === 0) {
      return false;
    }
    return items.every((item) => this.isLineUnavailable(item));
  }

  quotationEntryAllUnavailable(entry: DistributorQuotationHistoryEntry): boolean {
    const items = entry.items ?? [];
    if (items.length === 0) {
      return false;
    }
    return items.every((item) => this.isLineUnavailable(item));
  }

  isFinalChoiceDistributor(distributor: InquiryDistributor): boolean {
    return this.finalChoiceCompanyId() === distributor.companyId;
  }

  getDistributorListStep(distributor: InquiryDistributor): 'initiated' | 'in-progress' | 'green' {
    if (this.isFinalChoiceDistributor(distributor)) {
      return 'green';
    }
    if (this.inquiry()?.status === 'CLOSED') {
      return 'green';
    }
    if (distributor.responseReceived || distributor.requotationRequested) {
      return 'in-progress';
    }
    return 'initiated';
  }

  distributorEmailLabel(distributor: InquiryDistributor): string {
    if (!distributor.emailSent) {
      return '—';
    }
    return distributor.emailSentAt ? `Sent ${this.formatShortDate(distributor.emailSentAt)}` : 'Sent';
  }

  /** Date shown under each distributor name in the left list. */
  distributorListDateLabel(distributor: InquiryDistributor): string {
    if (distributor.responseReceived && distributor.responseReceivedAt) {
      return this.formatShortDate(distributor.responseReceivedAt);
    }
    if (distributor.emailSent && distributor.emailSentAt) {
      return this.formatShortDate(distributor.emailSentAt);
    }
    if (distributor.createdAt) {
      return this.formatShortDate(distributor.createdAt);
    }
    const inquiryCreatedAt = this.inquiry()?.createdAt;
    return inquiryCreatedAt ? this.formatPostedDate(inquiryCreatedAt) : '—';
  }

  distributorResponseLabel(distributor: InquiryDistributor): string {
    if (!distributor.responseReceived) {
      return '—';
    }
    return distributor.responseReceivedAt
      ? this.formatShortDate(distributor.responseReceivedAt)
      : 'Received';
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

  formatOptionalNumber(value: number | null | undefined): string {
    return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatOptionalPercent(value: number | null | undefined): string {
    return value == null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
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

  getQuotationLineDraft(item: InquiryItem): AdminInquiryLineDraft {
    return {
      hsnCode: item.distributorHsnCode,
      mrp: item.distributorMrp,
      discountPercentage: item.distributorDiscountPercentage,
      gstPercentage: item.distributorGstPercentage,
      ourDeliveryDate: item.distributorOurDeliveryDate,
    };
  }

  isLatestQuotationHistoryEntry(entry: DistributorQuotationHistoryEntry): boolean {
    return (
      entry.type === 'QUOTATION' &&
      (entry.round ?? 0) === this.latestQuotationHistoryRound() &&
      this.latestQuotationHistoryRound() > 0
    );
  }

  historyQuotationTitle(
    entry: DistributorQuotationHistoryEntry,
    distributor: InquiryDistributor,
  ): string {
    const name = this.distributorLabel(distributor);
    if (this.quotationEntryAllUnavailable(entry)) {
      return `${name} confirmed they do not have these products.`;
    }
    if ((entry.round ?? 1) > 1) {
      return `${name} shared a revised quotation.`;
    }
    return `${name} shared their quotation.`;
  }

  hasQuotationLine(item: InquiryItem): boolean {
    return hasDistributorQuotationResponse(item);
  }

  readonly isLineUnavailable = isDistributorLineUnavailable;

  quotationLineAmount(item: InquiryItem, draft?: AdminInquiryLineDraft): number | null {
    const lineDraft = draft ?? this.getQuotationLineDraft(item);
    if (lineDraft.mrp == null) {
      return null;
    }
    const discount = lineDraft.discountPercentage ?? 0;
    const unitAfterDiscount = lineDraft.mrp * (1 - discount / 100);
    return unitAfterDiscount * item.quantity;
  }

  quotationLineNetValue(item: InquiryItem, draft?: AdminInquiryLineDraft): number | null {
    const amount = this.quotationLineAmount(item, draft);
    if (amount == null) {
      return null;
    }
    const lineDraft = draft ?? this.getQuotationLineDraft(item);
    const gst = lineDraft.gstPercentage ?? 0;
    return amount * (1 + gst / 100);
  }

  quotationPdfAttachments(entry: InquiryTimelineEntry): InquiryTimelineAttachment[] {
    return (entry.attachments ?? []).filter((attachment) => attachment.mediaType === 'DOCUMENT');
  }

  openQuotationPdf(): void {
    const inquiry = this.inquiry();
    const distributor = this.distributors().find(
      (item) => item.companyId === this.selectedDistributorCompanyId(),
    );
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry || !distributorCompanyId || !distributor) {
      return;
    }

    this.inquiryService.downloadDistributorQuotationPdf(inquiry.id, distributorCompanyId).subscribe({
      next: (blob) => {
        this.openPdfInViewer(
          blob,
          'application/pdf',
          this.distributorQuotationPdfFileName(inquiry, distributor),
        );
      },
      error: (err) => {
        this.messageError.set('Could not open the distributor quotation PDF.');
        this.toast.fromApiError(err, 'Could not open the distributor quotation PDF.');
      },
    });
  }

  openSubmissionPdf(): void {
    const inquiry = this.inquiry();
    if (!inquiry) {
      return;
    }

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

  openAdminRfqPdf(): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry) {
      return;
    }

    const fileName = this.adminRfqPdfFileName(inquiry);
    const request$ = distributorCompanyId
      ? this.inquiryService.downloadDistributorRfqPdf(inquiry.id, distributorCompanyId)
      : this.inquiryService.downloadAdminRfqPdf(inquiry.id);

    request$.subscribe({
      next: (blob) => {
        this.openPdfInViewer(blob, 'application/pdf', fileName);
      },
      error: () => {
        // Fallback for older inquiries before scoped RFQ PDF was stored.
        if (distributorCompanyId) {
          this.inquiryService.downloadAdminRfqPdf(inquiry.id).subscribe({
            next: (blob) => {
              this.openPdfInViewer(blob, 'application/pdf', fileName);
            },
            error: () => this.openSubmissionPdf(),
          });
          return;
        }
        this.openSubmissionPdf();
      },
    });
  }

  submissionPdfFileName(inquiry: Inquiry): string {
    return `${inquiry.inquiryId}.pdf`;
  }

  adminRfqPdfFileName(inquiry: Inquiry): string {
    return `${inquiry.inquiryId}-rfq.pdf`;
  }

  distributorQuotationPdfFileName(inquiry: Inquiry, distributor: InquiryDistributor): string {
    const companySlug = this.distributorLabel(distributor)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return companySlug
      ? `${inquiry.inquiryId}-${companySlug}-quotation.pdf`
      : `${inquiry.inquiryId}-quotation.pdf`;
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

  private openPdfInViewer(blob: Blob, contentType: string, fileName: string): void {
    this.closeQuotationPdfViewer();
    const typedBlob = blob.type ? blob : new Blob([blob], { type: contentType });
    this.quotationPdfViewerObjectUrl = URL.createObjectURL(typedBlob);
    this.quotationPdfSafeUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(this.quotationPdfViewerObjectUrl),
    );
    this.quotationPdfViewerFileName.set(fileName);
    this.quotationPdfViewerOpen.set(true);
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

  private parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === '' || value == null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private formatShortDate(iso: string): string {
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
