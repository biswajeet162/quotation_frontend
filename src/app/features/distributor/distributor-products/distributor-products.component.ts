import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { finalize, map, of, switchMap, timeout } from 'rxjs';

import {

  CreateDistributorProductRequest,
  DistributorBrand,

  DistributorProductAttachment,

  DistributorProductEntry,

  UpdateDistributorProductRequest,

} from '../../../core/models/distributor.model';

import { DistributorProductService } from '../../../core/services/distributor/distributor-product.service';

import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';
import { ProductFieldAutocompleteComponent } from '../../products/product-field-autocomplete/product-field-autocomplete.component';

import { TimelineAttachmentMediaType } from '../../../core/models/inquiry-timeline.model';



type ProductFormMode = 'create' | 'edit';
type ProductSortColumn =
  | 'brand'
  | 'designation'
  | 'description'
  | 'rsp'
  | 'stockQuantity'
  | 'isActive'
  | 'attachmentCount';
type SortDirection = 'asc' | 'desc';



interface ProductFormState {

  brand: string;

  designation: string;

  description: string;

  specifications: string;

  rsp: string | number;

  stockQuantity: string | number;

}

interface PendingAttachment {
  id: string;
  file: File;
  mediaType: TimelineAttachmentMediaType;
}

interface BrandSummary {
  brandName: string;
  productCount: number;
  logoUrl: string | null;
}



const emptyForm = (): ProductFormState => ({

  brand: '',

  designation: '',

  description: '',

  specifications: '',

  rsp: '',

  stockQuantity: '1',

});



@Component({

  selector: 'app-distributor-products',

  imports: [
    FormsModule,
    LoadingOverlayComponent,
    InquiryChatAttachmentComponent,
    ProductFieldAutocompleteComponent,
  ],

  templateUrl: './distributor-products.component.html',

  styleUrl: './distributor-products.component.css',

})

export class DistributorProductsComponent implements OnInit, OnDestroy {

  private readonly productService = inject(DistributorProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);



  readonly loading = signal(true);

  readonly saving = signal(false);

  readonly overlayLoading = computed(() => this.loading() || this.saving());

  readonly errorMessage = signal<string | null>(null);

  readonly actionError = signal<string | null>(null);

  readonly products = signal<DistributorProductEntry[]>([]);

  readonly searchQuery = signal('');

  readonly activeMainTab = signal<'products' | 'brands'>('products');

  readonly selectedBrand = signal<string | null>(null);

  readonly brands = signal<BrandSummary[]>([]);
  readonly sortColumn = signal<ProductSortColumn>('brand');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly brandLogoUploading = signal<ReadonlySet<string>>(new Set());

  readonly brandLogoTarget = signal<string | null>(null);



  readonly formOpen = signal(false);

  readonly formMode = signal<ProductFormMode>('create');

  readonly editingProduct = signal<DistributorProductEntry | null>(null);

  readonly form = signal<ProductFormState>(emptyForm());

  readonly duplicateProductError = computed(() => {
    if (!this.formOpen()) {
      return null;
    }

    const brand = this.normalizeProductKey(this.form().brand);
    const designation = this.normalizeProductKey(this.form().designation);
    if (!brand || !designation) {
      return null;
    }

    const editingId = this.editingProduct()?.id;
    const exists = this.products().some(
      (product) =>
        product.id !== editingId &&
        this.normalizeProductKey(product.brand) === brand &&
        this.normalizeProductKey(product.designation) === designation,
    );

    return exists ? 'This brand and designation already exists.' : null;
  });

  readonly togglingActiveIds = signal<ReadonlySet<string>>(new Set());



  readonly attachmentPanelOpen = signal(false);

  readonly attachmentProduct = signal<DistributorProductEntry | null>(null);

  readonly attachments = signal<DistributorProductAttachment[]>([]);

  readonly attachmentsLoading = signal(false);

  readonly attachmentsUploading = signal(false);

  readonly attachmentError = signal<string | null>(null);

  readonly attachmentTabOptions: { type: TimelineAttachmentMediaType; label: string }[] = [
    { type: 'IMAGE', label: 'Images' },
    { type: 'VIDEO', label: 'Videos' },
    { type: 'DOCUMENT', label: 'Files' },
    { type: 'AUDIO', label: 'Voice' },
  ];

  readonly activeAttachmentTab = signal<TimelineAttachmentMediaType>('IMAGE');

  readonly attachmentsForActiveTab = computed(() =>
    this.attachments().filter((attachment) => attachment.mediaType === this.activeAttachmentTab()),
  );

  readonly pendingAttachments = signal<PendingAttachment[]>([]);

  readonly pendingAttachmentsForActiveTab = computed(() =>
    this.pendingAttachments().filter((attachment) => attachment.mediaType === this.activeAttachmentTab()),
  );

  readonly detailsOpen = signal(false);

  readonly detailsProduct = signal<DistributorProductEntry | null>(null);

  readonly detailsAttachments = signal<DistributorProductAttachment[]>([]);

  readonly detailsLoading = signal(false);

  readonly detailsError = signal<string | null>(null);

  readonly detailsAttachmentTab = signal<TimelineAttachmentMediaType>('IMAGE');

  readonly detailsAttachmentsForActiveTab = computed(() =>
    this.detailsAttachments().filter((attachment) => attachment.mediaType === this.detailsAttachmentTab()),
  );



  readonly recording = signal(false);

  readonly recordingSeconds = signal(0);

  readonly recordingLevels = signal<number[]>(Array.from({ length: 12 }, () => 0.15));



  private mediaRecorder: MediaRecorder | null = null;

  private recordingStream: MediaStream | null = null;

  private recordingChunks: Blob[] = [];

  private recordingMimeType = 'audio/webm';

  private recordingStartedAt = 0;

  private discardRecording = false;

  private audioContext: AudioContext | null = null;

  private analyser: AnalyserNode | null = null;

  private levelAnimationId: number | null = null;

  private durationTimerId: ReturnType<typeof setInterval> | null = null;

  private readonly recordingBarCount = 12;

  private readonly brandLogoObjectUrls = new Set<string>();

  readonly filteredProducts = computed(() => {

    const query = this.searchQuery().trim().toLowerCase();



    return this.products().filter((product) => {

      if (!query) {

        return true;

      }



      const haystack = [

        product.brand,

        product.designation,

        product.description,

      ]

        .filter(Boolean)

        .join(' ')

        .toLowerCase();



      return haystack.includes(query);

    });

  });

  readonly sortedFilteredProducts = computed(() =>
    this.sortProducts(this.filteredProducts(), this.sortColumn(), this.sortDirection()),
  );

  readonly selectedBrandProducts = computed(() => {
    const brand = this.selectedBrand();
    if (!brand) {
      return [] as DistributorProductEntry[];
    }
    const list = this.products().filter((product) => (product.brand ?? '').trim() === brand);
    return this.sortProducts(list, this.sortColumn(), this.sortDirection());
  });



  ngOnInit(): void {

    this.syncTabFromRoute();
    this.load();

  }



  ngOnDestroy(): void {

    this.cleanupRecordingResources(false);
    this.clearBrandLogoObjectUrls();

  }



  load(): void {

    this.loading.set(true);

    this.errorMessage.set(null);



    this.productService.listMine().subscribe({

      next: (list) => {

        this.products.set(list);
        this.loadBrands();

        this.loading.set(false);

      },

      error: () => {

        this.loading.set(false);

        this.errorMessage.set('Could not load your products.');

      },

    });

  }



  setMainTab(tab: 'products' | 'brands'): void {

    this.activeMainTab.set(tab);
    void this.router.navigate(['../', tab === 'products' ? 'my-products' : 'brands'], {
      relativeTo: this.route,
      replaceUrl: true,
    });
    if (tab === 'brands' && !this.selectedBrand() && this.brands().length > 0) {
      this.selectedBrand.set(this.brands()[0].brandName);
    }

  }



  selectBrand(brandName: string): void {

    this.selectedBrand.set(brandName);

  }



  isBrandLogoUploading(brandName: string): boolean {

    return this.brandLogoUploading().has(brandName);

  }



  prepareBrandLogoUpload(brandName: string): void {

    this.brandLogoTarget.set(brandName);

  }



  onBrandLogoSelected(event: Event): void {

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const brandName = this.brandLogoTarget();
    input.value = '';

    if (!brandName || !file) {
      return;
    }

    const mediaType = this.resolveMediaType(file);
    if (mediaType !== 'IMAGE') {
      this.actionError.set('Please select an image file for brand logo.');
      return;
    }

    this.actionError.set(null);
    this.brandLogoUploading.update((items) => new Set(items).add(brandName));

    this.productService.uploadBrandLogo(brandName, file).pipe(
      timeout(20000),
      finalize(() => {
        this.brandLogoUploading.update((items) => {
          const next = new Set(items);
          next.delete(brandName);
          return next;
        });
      }),
    ).subscribe({
      next: (brand) => {
        this.brandLogoTarget.set(null);
        this.applyUploadedBrandLogo({ ...brand, brandName: brand.brandName || brandName }, file);
      },
      error: () => {
        this.actionError.set('Could not update brand logo.');
      },
    });

  }



  getBrandInitials(brandName: string): string {

    const value = brandName.trim();
    if (!value) {
      return '?';
    }
    return value.slice(0, 2).toUpperCase();

  }

  getBrandLogoUrl(brandName: string | null | undefined): string | null {
    const name = this.toTrimmedString(brandName);
    if (!name) {
      return null;
    }
    const key = this.normalizeBrandName(name);
    return this.brands().find((brand) => this.normalizeBrandName(brand.brandName) === key)?.logoUrl ?? null;
  }



  toggleSort(column: ProductSortColumn): void {

    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortColumn.set(column);
    this.sortDirection.set('asc');

  }



  sortIcon(column: ProductSortColumn): string {

    if (this.sortColumn() !== column) {
      return '↕';
    }
    return this.sortDirection() === 'asc' ? '↑' : '↓';

  }



  openCreate(): void {

    this.formMode.set('create');

    this.editingProduct.set(null);

    this.form.set(emptyForm());

    this.actionError.set(null);
    this.attachmentError.set(null);
    this.activeAttachmentTab.set('IMAGE');
    this.attachments.set([]);
    this.pendingAttachments.set([]);
    this.attachmentProduct.set(null);

    this.formOpen.set(true);

  }



  openEdit(product: DistributorProductEntry): void {

    this.formMode.set('edit');

    this.editingProduct.set(product);

    this.form.set({

      brand: product.brand ?? '',

      designation: product.designation ?? '',

      description: product.description ?? '',

      specifications: product.specifications ?? '',

      rsp: product.rsp != null ? String(product.rsp) : '',

      stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : '1',

    });

    this.actionError.set(null);
    this.attachmentError.set(null);
    this.activeAttachmentTab.set('IMAGE');
    this.pendingAttachments.set([]);
    this.attachmentProduct.set(product);
    this.loadAttachments(product.id);

    this.formOpen.set(true);

  }



  closeForm(): void {

    if (this.saving()) {

      return;

    }

    this.formOpen.set(false);

    this.editingProduct.set(null);

    this.actionError.set(null);
    this.attachmentError.set(null);
    this.pendingAttachments.set([]);
    this.attachments.set([]);
    this.attachmentProduct.set(null);

  }



  openDetails(product: DistributorProductEntry): void {

    this.detailsProduct.set(product);
    this.detailsOpen.set(true);
    this.detailsError.set(null);
    this.detailsAttachmentTab.set('IMAGE');
    this.loadDetailsAttachments(product.id);

  }



  closeDetails(): void {

    this.detailsOpen.set(false);
    this.detailsProduct.set(null);
    this.detailsAttachments.set([]);
    this.detailsError.set(null);
    this.detailsAttachmentTab.set('IMAGE');

  }



  setDetailsAttachmentTab(tab: TimelineAttachmentMediaType): void {

    this.detailsAttachmentTab.set(tab);

  }



  detailsAttachmentCountFor(tab: TimelineAttachmentMediaType): number {

    return this.detailsAttachments().filter((attachment) => attachment.mediaType === tab).length;

  }



  openAttachments(product: DistributorProductEntry): void {

    this.attachmentProduct.set(product);

    this.attachmentPanelOpen.set(true);

    this.attachmentError.set(null);

    this.activeAttachmentTab.set('IMAGE');

    this.loadAttachments(product.id);

  }



  closeAttachments(): void {

    if (this.attachmentsUploading() || this.recording()) {

      return;

    }

    this.attachmentPanelOpen.set(false);

    this.attachmentProduct.set(null);

    this.attachments.set([]);

    this.attachmentError.set(null);

    this.activeAttachmentTab.set('IMAGE');

  }



  setAttachmentTab(tab: TimelineAttachmentMediaType): void {

    this.activeAttachmentTab.set(tab);

    this.attachmentError.set(null);

  }



  attachmentCountFor(tab: TimelineAttachmentMediaType): number {

    if (this.formOpen() && this.formMode() === 'create') {
      return this.pendingAttachments().filter((attachment) => attachment.mediaType === tab).length;
    }

    return this.attachments().filter((attachment) => attachment.mediaType === tab).length;

  }



  removePendingAttachment(id: string): void {

    this.pendingAttachments.update((items) => items.filter((item) => item.id !== id));

  }



  activeAttachmentTabLabel(): string {

    return (

      this.attachmentTabOptions.find((tab) => tab.type === this.activeAttachmentTab())?.label ??

      'Attachments'

    );

  }



  loadAttachments(productId: string): void {

    this.attachmentsLoading.set(true);

    this.attachmentError.set(null);



    this.productService.listAttachments(productId).subscribe({

      next: (list) => {

        this.attachments.set(list);

        this.attachmentsLoading.set(false);

        this.updateAttachmentCount(productId, list.length);

        this.selectInitialAttachmentTab(list);

      },

      error: () => {

        this.attachmentsLoading.set(false);

        this.attachmentError.set('Could not load attachments.');

      },

    });

  }



  loadDetailsAttachments(productId: string): void {

    this.detailsLoading.set(true);
    this.detailsError.set(null);

    this.productService.listAttachments(productId).subscribe({
      next: (list) => {
        this.detailsAttachments.set(list);
        this.detailsLoading.set(false);
        const firstWithItems = this.attachmentTabOptions
          .map((tab) => tab.type)
          .find((type) => list.some((attachment) => attachment.mediaType === type));
        this.detailsAttachmentTab.set(firstWithItems ?? 'IMAGE');
      },
      error: () => {
        this.detailsLoading.set(false);
        this.detailsError.set('Could not load product details.');
      },
    });

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

        this.handleSelectedFiles([file]);

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



  deleteAttachment(attachment: DistributorProductAttachment): void {

    const product = this.attachmentProduct();

    if (!product || this.attachmentsUploading()) {

      return;

    }



    this.attachmentsUploading.set(true);

    this.attachmentError.set(null);



    this.productService.deleteAttachment(attachment.id).subscribe({

      next: () => {

        this.attachments.update((items) => items.filter((item) => item.id !== attachment.id));

        this.updateAttachmentCount(product.id, this.attachments().length);

        this.attachmentsUploading.set(false);

      },

      error: () => {

        this.attachmentsUploading.set(false);

        this.attachmentError.set('Could not delete attachment.');

      },

    });

  }



  saveForm(): void {

    const state = this.form();

    if (
      !this.toTrimmedString(state.brand) ||
      !this.toTrimmedString(state.designation) ||
      !this.toTrimmedString(state.rsp)
    ) {

      this.actionError.set('Brand, designation, and RSP are required.');

      return;

    }

    const duplicateError = this.duplicateProductError();
    if (duplicateError) {
      this.actionError.set(duplicateError);
      return;
    }



    this.saving.set(true);

    this.actionError.set(null);



    if (this.formMode() === 'create') {

      const request = this.toCreateRequest(state);
      const pendingFiles = this.pendingAttachments().map((attachment) => attachment.file);

      this.productService
        .create(request)
        .pipe(
          timeout(20000),
          switchMap((created) => {
            if (pendingFiles.length === 0) {
              return of({ created, attachmentCount: 0 });
            }
            return this.productService.uploadAttachments(created.id, pendingFiles).pipe(
              timeout(20000),
              map((uploaded) => ({ created, attachmentCount: uploaded.length })),
            );
          }),
          finalize(() => this.saving.set(false)),
        )
        .subscribe({

        next: ({ created, attachmentCount }) => {

          this.products.update((list) => [
            {
              ...created,
              attachmentCount: (created.attachmentCount ?? 0) + attachmentCount,
            },
            ...list,
          ]);

          this.formOpen.set(false);
          this.pendingAttachments.set([]);
          this.attachments.set([]);
          this.attachmentProduct.set(null);
          this.loadBrands();

        },

        error: (err) => {

          this.actionError.set(err?.error?.message ?? 'Could not add product. Please try again.');

        },

      });

      return;

    }



    const editing = this.editingProduct();

    if (!editing) {

      this.saving.set(false);

      return;

    }



    const request = this.toUpdateRequest(state);

    this.productService
      .update(editing.id, request)
      .pipe(
        timeout(20000),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({

      next: (updated) => {

        this.products.update((list) =>

          list.map((item) => (item.id === updated.id ? updated : item)),

        );

        this.formOpen.set(false);
        this.loadBrands();

      },

      error: (err) => {

        this.actionError.set(err?.error?.message ?? 'Could not update product. Please try again.');

      },

    });

  }



  isTogglingActive(productId: string): boolean {

    return this.togglingActiveIds().has(productId);

  }



  onActiveToggle(product: DistributorProductEntry): void {

    if (this.isTogglingActive(product.id)) {

      return;

    }

    this.toggleActive(product);

  }



  toggleActive(product: DistributorProductEntry): void {

    const action = product.isActive

      ? this.productService.deactivate(product.id)

      : this.productService.activate(product.id);



    this.togglingActiveIds.update((ids) => new Set(ids).add(product.id));

    this.actionError.set(null);



    action.subscribe({

      next: () => {

        this.products.update((list) =>

          list.map((item) =>

            item.id === product.id ? { ...item, isActive: !product.isActive } : item,

          ),

        );

        this.togglingActiveIds.update((ids) => {

          const next = new Set(ids);

          next.delete(product.id);

          return next;

        });

      },

      error: () => {

        this.togglingActiveIds.update((ids) => {

          const next = new Set(ids);

          next.delete(product.id);

          return next;

        });

        this.actionError.set('Could not update product status.');

      },

    });

  }



  updateFormField<K extends keyof ProductFormState>(field: K, value: ProductFormState[K]): void {

    this.form.update((current) => ({ ...current, [field]: value }));

    if (field === 'brand' || field === 'designation') {
      this.actionError.set(null);
    }

  }



  private selectInitialAttachmentTab(list: DistributorProductAttachment[]): void {

    const order: TimelineAttachmentMediaType[] = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'];

    const firstWithItems = order.find((type) => list.some((attachment) => attachment.mediaType === type));

    this.activeAttachmentTab.set(firstWithItems ?? 'IMAGE');

  }



  private onFilesSelectedWithType(event: Event, expected: TimelineAttachmentMediaType): void {

    const input = event.target as HTMLInputElement;

    const files = input.files;

    if (!files?.length) {

      return;

    }



    const validFiles: File[] = [];

    for (const file of Array.from(files)) {

      const mediaType = this.resolveMediaType(file);

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

      this.handleSelectedFiles(validFiles);

    }

  }



  private handleSelectedFiles(files: File[]): void {

    if (files.length === 0) {
      return;
    }

    if (this.formOpen() && this.formMode() === 'create') {
      this.queuePendingFiles(files);
      return;
    }

    this.uploadFiles(files);

  }



  private queuePendingFiles(files: File[]): void {

    this.attachmentError.set(null);

    const queued = files
      .map((file) => {
        const mediaType = this.resolveMediaType(file);
        if (!mediaType) {
          return null;
        }
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          mediaType,
        } as PendingAttachment;
      })
      .filter((item): item is PendingAttachment => Boolean(item));

    if (queued.length === 0) {
      this.attachmentError.set('Could not queue selected attachment files.');
      return;
    }

    this.pendingAttachments.update((items) => [...items, ...queued]);
    this.activeAttachmentTab.set(queued[0].mediaType);

  }



  private uploadFiles(files: File[]): void {

    const product = this.attachmentProduct();

    if (!product || files.length === 0) {

      return;

    }



    this.attachmentsUploading.set(true);

    this.attachmentError.set(null);



    this.productService.uploadAttachments(product.id, files).subscribe({

      next: (uploaded) => {

        this.attachments.update((items) => [...items, ...uploaded]);

        this.updateAttachmentCount(product.id, this.attachments().length);

        if (uploaded.length > 0) {

          this.activeAttachmentTab.set(uploaded[0].mediaType);

        }

        this.attachmentsUploading.set(false);

      },

      error: (err) => {

        this.attachmentsUploading.set(false);

        this.attachmentError.set(err?.error?.message ?? 'Could not upload attachment.');

      },

    });

  }



  private updateAttachmentCount(productId: string, count: number): void {

    this.products.update((list) =>

      list.map((item) => (item.id === productId ? { ...item, attachmentCount: count } : item)),

    );

    const current = this.attachmentProduct();

    if (current?.id === productId) {

      this.attachmentProduct.set({ ...current, attachmentCount: count });

    }

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

    if (/\.(pdf|docx?|xlsx?|pptx?|ppsx?|txt|csv|rtf|odt|ods)$/.test(lower)) {

      return true;

    }

    return (

      contentType === 'application/pdf' ||

      contentType === 'application/msword' ||

      contentType === 'text/plain' ||

      contentType === 'text/csv' ||

      contentType.startsWith('application/vnd.openxmlformats-officedocument.') ||

      contentType.startsWith('application/vnd.oasis.opendocument.')

    );

  }



  private loadBrands(): void {
    this.clearBrandLogoObjectUrls();
    this.productService.listBrands().subscribe({
      next: (brands) => {
        const normalized: BrandSummary[] = brands
          .map((brand: DistributorBrand) => ({
            brandName: this.toTrimmedString(brand.brandName),
            productCount: brand.productCount ?? 0,
            logoUrl: brand.logoUrl ?? null,
          }))
          .filter((brand) => !!brand.brandName)
          .sort((a, b) => a.brandName.localeCompare(b.brandName));

        this.brands.set(normalized);

        const selected = this.selectedBrand();
        const stillExists = normalized.some((brand) => brand.brandName === selected);
        if (!stillExists) {
          this.selectedBrand.set(normalized[0]?.brandName ?? null);
        }

        this.resolveBrandLogoPreviews();
      },
      error: () => {
        this.brands.set([]);
        this.selectedBrand.set(null);
      },
    });
  }

  private syncTabFromRoute(): void {
    const lastSegment = this.route.snapshot.url.at(-1)?.path;
    if (lastSegment === 'brands') {
      this.activeMainTab.set('brands');
      return;
    }
    this.activeMainTab.set('products');
  }

  private sortProducts(
    list: DistributorProductEntry[],
    column: ProductSortColumn,
    direction: SortDirection,
  ): DistributorProductEntry[] {
    const factor = direction === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const compare = this.compareByColumn(a, b, column);
      return compare * factor;
    });
  }

  private compareByColumn(
    a: DistributorProductEntry,
    b: DistributorProductEntry,
    column: ProductSortColumn,
  ): number {
    switch (column) {
      case 'rsp':
        return (a.rsp ?? 0) - (b.rsp ?? 0);
      case 'stockQuantity':
        return (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0);
      case 'isActive':
        return Number(a.isActive ?? false) - Number(b.isActive ?? false);
      case 'attachmentCount':
        return (a.attachmentCount ?? 0) - (b.attachmentCount ?? 0);
      case 'designation':
        return (a.designation ?? '').localeCompare(b.designation ?? '');
      case 'description':
        return (a.description ?? '').localeCompare(b.description ?? '');
      case 'brand':
      default:
        return (a.brand ?? '').localeCompare(b.brand ?? '');
    }
  }

  private resolveBrandLogoPreviews(): void {
    this.brands().forEach((brand) => {
      if (!brand.logoUrl || brand.logoUrl.startsWith('blob:')) {
        return;
      }

      this.productService.fetchBrandLogoBlob(brand.logoUrl).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.brandLogoObjectUrls.add(objectUrl);
          this.updateBrandLogoPreview(brand.brandName, objectUrl);
        },
      });
    });
  }

  private applyUploadedBrandLogo(brand: DistributorBrand, previewFile?: File): void {
    if (!brand.brandName) {
      return;
    }
    if (previewFile) {
      const objectUrl = URL.createObjectURL(previewFile);
      this.brandLogoObjectUrls.add(objectUrl);
      this.updateBrandLogoPreview(brand.brandName, objectUrl);
      return;
    }
    if (!brand.logoUrl) {
      return;
    }
    this.productService.fetchBrandLogoBlob(brand.logoUrl).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.brandLogoObjectUrls.add(objectUrl);
        this.updateBrandLogoPreview(brand.brandName, objectUrl);
      },
      error: () => {
        this.updateBrandLogoPreview(brand.brandName, brand.logoUrl ?? null);
      },
    });
  }

  private updateBrandLogoPreview(brandName: string, logoUrl: string | null): void {
    const key = this.normalizeBrandName(brandName);
    this.brands.update((items) =>
      items.map((item) =>
        this.normalizeBrandName(item.brandName) === key ? { ...item, logoUrl } : item,
      ),
    );
  }

  private normalizeBrandName(brandName: string | null | undefined): string {
    return this.toTrimmedString(brandName).toLowerCase();
  }

  private clearBrandLogoObjectUrls(): void {
    this.brandLogoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.brandLogoObjectUrls.clear();
  }



  private toCreateRequest(state: ProductFormState): CreateDistributorProductRequest {

    return {

      brand: this.toTrimmedString(state.brand),

      designation: this.toTrimmedString(state.designation),

      description: this.toTrimmedString(state.description) || undefined,

      specifications: this.toTrimmedString(state.specifications) || undefined,

      rsp: this.parseNumber(state.rsp),

      stockQuantity: this.parseInteger(state.stockQuantity, 1),

    };

  }



  private toUpdateRequest(state: ProductFormState): UpdateDistributorProductRequest {

    return this.toCreateRequest(state);

  }



  private parseNumber(value: string | number): number | undefined {

    const trimmed = this.toTrimmedString(value);

    if (!trimmed) {

      return undefined;

    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : undefined;

  }



  private parseInteger(value: string | number, fallback: number): number {

    const trimmed = this.toTrimmedString(value);

    if (!trimmed) {

      return fallback;

    }

    const parsed = Number.parseInt(trimmed, 10);

    return Number.isFinite(parsed) ? parsed : fallback;

  }



  private normalizeProductKey(value: unknown): string {
    return this.toTrimmedString(value).toLowerCase();
  }

  private toTrimmedString(value: unknown): string {

    if (value == null) {

      return '';

    }

    return String(value).trim();

  }

}


