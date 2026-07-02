import { Component, computed, HostListener, inject, OnDestroy, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ConsumerDashboardService } from '../../../core/services/consumer/consumer-dashboard.service';
import { InquiryCartService } from '../../../core/services/inquiry/inquiry-cart.service';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { ProductService } from '../../../core/services/product/product.service';
import { ProductCatalogLookupService } from '../../../core/services/product/product-catalog-lookup.service';
import { ProductQueryFormService } from '../../../core/services/product/product-query-form.service';
import { ConsumerProfile } from '../../../core/models/consumer.model';
import { ConsumerInquiryCreated } from '../../../core/models/inquiry.model';
import { ProductFormDraft, ProductFormRow, RowLocalAttachment } from '../../../core/models/product-form.model';
import { InquiryTimelineAttachment, TimelineAttachmentMediaType } from '../../../core/models/inquiry-timeline.model';
import { formatSpecificationsInline } from '../../../shared/utils/specifications-display.util';
import { resolveAttachmentMediaType } from '../../../shared/utils/attachment-media-type.util';
import { ProductFieldAutocompleteComponent } from '../product-field-autocomplete/product-field-autocomplete.component';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

interface QueryAttachmentItem {
  key: string;
  localId: string;
  timelineAttachment: InquiryTimelineAttachment;
}

@Component({
  selector: 'app-product-request-panel',
  imports: [
    FormsModule,
    ProductFieldAutocompleteComponent,
    LoadingOverlayComponent,
    InquiryChatAttachmentComponent,
  ],
  templateUrl: './product-request-panel.component.html',
  styleUrl: './product-request-panel.component.css',
})
export class ProductRequestPanelComponent implements OnInit, OnDestroy {
  private readonly cart = inject(InquiryCartService);
  private readonly inquiryService = inject(InquiryService);
  private readonly auth = inject(AuthService);
  private readonly consumerDashboard = inject(ConsumerDashboardService);
  private readonly productService = inject(ProductService);
  private readonly catalog = inject(ProductCatalogLookupService);
  readonly formState = inject(ProductQueryFormService);

  readonly submitted = output<ConsumerInquiryCreated>();

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly lastSubmitted = signal<ConsumerInquiryCreated | null>(null);
  readonly previewOpen = signal(false);
  readonly companyProfile = signal<ConsumerProfile | null>(null);
  readonly companyLogoUrl = signal<string | null>(null);
  readonly profileLoading = signal(false);

  readonly attachmentPanelOpen = signal(false);
  readonly attachmentRow = signal<ProductFormRow | null>(null);
  readonly attachmentError = signal<string | null>(null);
  readonly activeAttachmentTab = signal<TimelineAttachmentMediaType>('IMAGE');

  readonly recording = signal(false);
  readonly recordingSeconds = signal(0);
  readonly recordingLevels = signal<number[]>(Array.from({ length: 24 }, () => 0.15));

  readonly attachmentTabOptions: { type: TimelineAttachmentMediaType; label: string }[] = [
    { type: 'IMAGE', label: 'Images' },
    { type: 'VIDEO', label: 'Videos' },
    { type: 'DOCUMENT', label: 'Files' },
    { type: 'AUDIO', label: 'Voice' },
  ];

  readonly attachmentsForActiveTab = computed(() => {
    const tab = this.activeAttachmentTab();
    const row = this.attachmentRow();
    return (row?.localAttachments ?? [])
      .filter((attachment) => attachment.mediaType === tab)
      .map((attachment) => this.toLocalAttachmentItem(attachment));
  });

  readonly rows = this.formState.rows;
  readonly highlight = this.formState.highlight;

  readonly quotationDate = computed(() => this.formatQuotationDate(new Date()));

  readonly previewCompanyName = computed(() => {
    const profile = this.companyProfile();
    const user = this.auth.currentUser();
    return profile?.companyName?.trim() || user?.companyName?.trim() || 'Your company';
  });

  readonly previewCompanyAddress = computed(() => this.formatAddress(this.companyProfile()));

  readonly previewContactName = computed(() => {
    const profile = this.companyProfile();
    return profile?.userName?.trim() || 'Contact Person';
  });

  readonly previewCustomerAddress = computed(() => this.formatAddress(this.companyProfile()));

  readonly previewContactPhone = computed(() => {
    const profile = this.companyProfile();
    return profile?.companyPhone?.trim() || '—';
  });

  readonly previewContactEmail = computed(() => {
    const profile = this.companyProfile();
    return profile?.email?.trim() || profile?.companyEmail?.trim() || '—';
  });

  private logoObjectUrl: string | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordingStream: MediaStream | null = null;
  private recordingChunks: Blob[] = [];
  private recordingMimeType = 'audio/webm';
  private discardRecording = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelAnimationId: number | null = null;
  private durationTimerId: ReturnType<typeof setInterval> | null = null;
  private recordingStartedAt = 0;
  private readonly recordingBarCount = 24;

  ngOnInit(): void {
    this.catalog.ensureLoaded();
    this.catalog.ensureConsumerBrandsLoaded();
  }

  ngOnDestroy(): void {
    this.cleanupRecordingResources(false);
    this.revokeLogoUrl();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.attachmentPanelOpen()) {
      this.closeAttachments();
      return;
    }
    if (this.previewOpen()) {
      this.closePreview();
    }
  }

  addRow(): void {
    this.formState.addRow();
  }

  removeRow(rowId: string): void {
    this.formState.removeRow(rowId);
  }

  updateRowField<K extends keyof ProductFormDraft>(
    rowId: string,
    field: K,
    value: ProductFormDraft[K],
  ): void {
    this.formState.updateRow(rowId, { [field]: value });
  }

  updateDesignation(rowId: string, value: string): void {
    const row = this.rows().find((entry) => entry.rowId === rowId);
    const patch: Partial<ProductFormDraft> = { designation: value };
    if (row?.catalogProductId && row.designation !== value) {
      patch.catalogProductId = undefined;
      patch.lineSource = 'NEW_PRODUCT';
    }
    this.formState.updateRow(rowId, patch);
  }

  updateRowQuantity(rowId: string, value: string): void {
    this.updateRowField(rowId, 'quantity', Math.max(1, Number(value) || 1));
  }

  openRowAttachments(row: ProductFormRow, event: Event): void {
    event.stopPropagation();
    this.attachmentRow.set(row);
    this.attachmentPanelOpen.set(true);
    this.attachmentError.set(null);
    this.activeAttachmentTab.set(this.initialTabForRow(row));
  }

  closeAttachments(): void {
    this.cancelVoiceRecording();
    this.attachmentPanelOpen.set(false);
    this.attachmentRow.set(null);
    this.attachmentError.set(null);
    this.activeAttachmentTab.set('IMAGE');
  }

  setAttachmentTab(tab: TimelineAttachmentMediaType): void {
    this.activeAttachmentTab.set(tab);
  }

  attachmentCountFor(tab: TimelineAttachmentMediaType): number {
    const row = this.attachmentRow();
    return (row?.localAttachments ?? []).filter((item) => item.mediaType === tab).length;
  }

  activeAttachmentTabLabel(): string {
    return (
      this.attachmentTabOptions.find((tab) => tab.type === this.activeAttachmentTab())?.label ??
      'Attachments'
    );
  }

  rowAttachmentCount(row: ProductFormRow): number {
    return this.formState.rowAttachmentCount(row);
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

  removeAttachment(item: QueryAttachmentItem): void {
    const row = this.attachmentRow();
    if (!row) {
      return;
    }
    this.formState.removeLocalAttachment(row.rowId, item.localId);
    this.attachmentRow.set(this.rows().find((entry) => entry.rowId === row.rowId) ?? null);
  }

  async startVoiceRecording(): Promise<void> {
    if (this.recording() || !navigator.mediaDevices?.getUserMedia) {
      this.attachmentError.set('Voice recording is not supported in this browser.');
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

      this.mediaRecorder.ondataavailable = (recordingEvent) => {
        if (recordingEvent.data.size > 0) {
          this.recordingChunks.push(recordingEvent.data);
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
        this.addLocalFiles([file]);
        this.discardRecording = false;
      };

      this.mediaRecorder.start(250);
      this.recordingStartedAt = Date.now();
      this.recordingSeconds.set(0);
      this.recordingLevels.set(Array.from({ length: this.recordingBarCount }, () => 0.15));
      this.recording.set(true);
      this.attachmentError.set(null);

      this.durationTimerId = setInterval(() => {
        this.recordingSeconds.set(Math.floor((Date.now() - this.recordingStartedAt) / 1000));
      }, 200);
      this.startLevelMonitor();
    } catch {
      this.cleanupRecordingResources(false);
      this.attachmentError.set('Microphone access was denied or unavailable.');
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
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
  }

  openPreview(): void {
    this.submitError.set(null);
    this.previewOpen.set(true);
    document.body.style.overflow = 'hidden';
    this.loadCompanyProfile();
  }

  closePreview(): void {
    this.previewOpen.set(false);
    document.body.style.overflow = '';
  }

  downloadPreview(): void {
    window.print();
  }

  companyInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  formatQuotationDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  previewItemLabel(row: ProductFormRow): string {
    const brand = row.brand.trim();
    const designation = row.designation.trim();
    if (brand && designation) {
      return `${brand} ${designation}`;
    }
    return brand || designation || '—';
  }

  clearForm(): void {
    this.formState.resetRows();
    this.submitError.set(null);
    this.lastSubmitted.set(null);
    this.closePreview();
    this.closeAttachments();
  }

  submitAnother(): void {
    this.lastSubmitted.set(null);
    this.formState.resetRows();
    this.submitError.set(null);
    this.closePreview();
    this.closeAttachments();
  }

  previewRows(): ProductFormRow[] {
    return this.rows().filter((r) => !this.formState.isEmptyRow(r));
  }

  totalPreviewQty(): number {
    return this.previewRows().reduce((sum, row) => sum + row.quantity, 0);
  }

  previewField(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) {
      return '—';
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return formatSpecificationsInline(value) || '—';
    }
    return trimmed;
  }

  submitRequest(): void {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'CONSUMER') {
      this.submitError.set('Only consumer accounts can create quotations.');
      return;
    }

    const valid = this.previewRows();
    if (valid.length === 0) {
      this.submitError.set('Add at least one product row with some details.');
      return;
    }

    const notSubmittable = valid.filter(
      (r) => !r.catalogProductId && (!r.brand.trim() || !r.designation.trim()),
    );
    if (notSubmittable.length > 0) {
      this.submitError.set(
        'Each product row needs brand and designation, or must be added from the catalog.',
      );
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    const localFiles = this.formState.collectLocalFiles(valid);

    const productRequests = valid.map((row) =>
      row.catalogProductId
        ? of({ row, productId: row.catalogProductId })
        : this.productService
            .findOrCreate(this.formState.toFindOrCreateRequest(row))
            .pipe(map((product) => ({ row, productId: product.id }))),
    );

    forkJoin(productRequests)
      .pipe(
        switchMap((resolved) => {
          const title =
            resolved.length === 1
              ? `${resolved[0].row.brand.trim()} ${resolved[0].row.designation.trim()}`
              : `Quotation request (${resolved.length} products)`;

          const description =
            resolved.length === 1 ? resolved[0].row.description.trim() || undefined : undefined;

          return this.inquiryService.create({
            title,
            description,
            searchTerm: this.cart.searchTerm().trim() || undefined,
            items: resolved.map(({ row, productId }) => ({
              productId,
              quantity: row.quantity,
              notes: row.lineNotes.trim() || undefined,
              lineSource: row.lineSource,
            })),
          });
        }),
        switchMap((inquiry) => {
          if (localFiles.length === 0 || !inquiry.id) {
            return of(inquiry);
          }
          return this.inquiryService
            .postMessageWithAttachments(inquiry.id, 'Attachments from quotation request', localFiles)
            .pipe(
              map(() => inquiry),
              catchError(() => of(inquiry)),
            );
        }),
      )
      .subscribe({
        next: (inquiry) => {
          this.submitting.set(false);
          this.cart.clear();
          this.formState.resetRows();
          this.closePreview();
          this.closeAttachments();
          this.lastSubmitted.set(inquiry);
          this.submitted.emit(inquiry);
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Could not submit your quotation request. Please try again.');
        },
      });
  }

  private addLocalFiles(files: File[]): void {
    const row = this.attachmentRow();
    if (!row || files.length === 0) {
      return;
    }
    this.formState.addLocalFiles(row.rowId, files);
    const updated = this.rows().find((entry) => entry.rowId === row.rowId);
    if (updated) {
      this.attachmentRow.set(updated);
      const lastAdded = updated.localAttachments.at(-1);
      if (lastAdded) {
        this.activeAttachmentTab.set(lastAdded.mediaType);
      }
    }
  }

  private onFilesSelectedWithType(event: Event, expected: TimelineAttachmentMediaType): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      const mediaType = resolveAttachmentMediaType(file);
      if (mediaType !== expected) {
        const label =
          expected === 'IMAGE'
            ? 'Please choose an image file.'
            : expected === 'VIDEO'
              ? 'Please choose a video file.'
              : 'Please choose a document file (PDF, Word, Excel, etc.).';
        this.attachmentError.set(label);
        continue;
      }
      validFiles.push(file);
    }

    input.value = '';
    if (validFiles.length > 0) {
      this.attachmentError.set(null);
      this.addLocalFiles(validFiles);
    }
  }

  private initialTabForRow(row: ProductFormRow): TimelineAttachmentMediaType {
    const order: TimelineAttachmentMediaType[] = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'];
    const firstWithItems = order.find((type) =>
      row.localAttachments.some((attachment) => attachment.mediaType === type),
    );
    return firstWithItems ?? 'IMAGE';
  }

  private toLocalAttachmentItem(attachment: RowLocalAttachment): QueryAttachmentItem {
    return {
      key: attachment.localId,
      localId: attachment.localId,
      timelineAttachment: {
        id: attachment.localId,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        mediaType: attachment.mediaType,
        url: attachment.blobUrl,
      },
    };
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

  private loadCompanyProfile(): void {
    if (this.companyProfile() || this.profileLoading()) {
      return;
    }

    this.profileLoading.set(true);
    this.consumerDashboard.getProfile().subscribe({
      next: (profile) => {
        this.companyProfile.set(profile);
        this.profileLoading.set(false);
        if (profile.consumerLogoUrl) {
          this.consumerDashboard.loadLogoBlob().subscribe({
            next: (blob) => {
              this.revokeLogoUrl();
              this.logoObjectUrl = URL.createObjectURL(blob);
              this.companyLogoUrl.set(this.logoObjectUrl);
            },
            error: () => this.companyLogoUrl.set(null),
          });
        }
      },
      error: () => this.profileLoading.set(false),
    });
  }

  private formatAddress(profile: ConsumerProfile | null): string {
    if (!profile) {
      return '—';
    }
    const parts = [profile.address, profile.city, profile.state, profile.country, profile.pinCode]
      .map((part) => part?.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  }

  private revokeLogoUrl(): void {
    if (this.logoObjectUrl) {
      URL.revokeObjectURL(this.logoObjectUrl);
      this.logoObjectUrl = null;
    }
    this.companyLogoUrl.set(null);
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
}
