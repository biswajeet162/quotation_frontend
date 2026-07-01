import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import {

  CreateDistributorProductRequest,

  DistributorProductAttachment,

  DistributorProductEntry,

  UpdateDistributorProductRequest,

} from '../../../core/models/distributor.model';

import { DistributorProductService } from '../../../core/services/distributor/distributor-product.service';

import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';

import { TimelineAttachmentMediaType } from '../../../core/models/inquiry-timeline.model';



type ProductFormMode = 'create' | 'edit';



interface ProductFormState {

  brand: string;

  designation: string;

  groupName: string;

  category: string;

  description: string;

  specifications: string;

  aliasNames: string;

  rsp: string;

  discountPercentage: string;

  gstPercentage: string;

  stockQuantity: string;

  leadTimeDays: string;

  minOrderQuantity: string;

  priceValidTill: string;

  extraInfo: string;

}



const emptyForm = (): ProductFormState => ({

  brand: '',

  designation: '',

  groupName: '',

  category: '',

  description: '',

  specifications: '',

  aliasNames: '',

  rsp: '',

  discountPercentage: '',

  gstPercentage: '',

  stockQuantity: '0',

  leadTimeDays: '7',

  minOrderQuantity: '1',

  priceValidTill: '',

  extraInfo: '',

});



@Component({

  selector: 'app-distributor-products',

  imports: [FormsModule, LoadingOverlayComponent, InquiryChatAttachmentComponent],

  templateUrl: './distributor-products.component.html',

  styleUrl: './distributor-products.component.css',

})

export class DistributorProductsComponent implements OnInit, OnDestroy {

  private readonly productService = inject(DistributorProductService);



  readonly loading = signal(true);

  readonly saving = signal(false);

  readonly overlayLoading = computed(() => this.loading() || this.saving());

  readonly errorMessage = signal<string | null>(null);

  readonly actionError = signal<string | null>(null);

  readonly products = signal<DistributorProductEntry[]>([]);

  readonly searchQuery = signal('');



  readonly formOpen = signal(false);

  readonly formMode = signal<ProductFormMode>('create');

  readonly editingProduct = signal<DistributorProductEntry | null>(null);

  readonly form = signal<ProductFormState>(emptyForm());

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



  readonly filteredProducts = computed(() => {

    const query = this.searchQuery().trim().toLowerCase();



    return this.products().filter((product) => {

      if (!query) {

        return true;

      }



      const haystack = [

        product.brand,

        product.designation,

        product.category,

        product.groupName,

        product.description,

      ]

        .filter(Boolean)

        .join(' ')

        .toLowerCase();



      return haystack.includes(query);

    });

  });



  ngOnInit(): void {

    this.load();

  }



  ngOnDestroy(): void {

    this.cleanupRecordingResources(false);

  }



  load(): void {

    this.loading.set(true);

    this.errorMessage.set(null);



    this.productService.listMine().subscribe({

      next: (list) => {

        this.products.set(list);

        this.loading.set(false);

      },

      error: () => {

        this.loading.set(false);

        this.errorMessage.set('Could not load your products.');

      },

    });

  }



  openCreate(): void {

    this.formMode.set('create');

    this.editingProduct.set(null);

    this.form.set(emptyForm());

    this.actionError.set(null);

    this.formOpen.set(true);

  }



  openEdit(product: DistributorProductEntry): void {

    this.formMode.set('edit');

    this.editingProduct.set(product);

    this.form.set({

      brand: product.brand ?? '',

      designation: product.designation ?? '',

      groupName: product.groupName ?? '',

      category: product.category ?? '',

      description: product.description ?? '',

      specifications: product.specifications ?? '',

      aliasNames: product.aliasNames ?? '',

      rsp: product.rsp != null ? String(product.rsp) : '',

      discountPercentage:

        product.discountPercentage != null ? String(product.discountPercentage) : '',

      gstPercentage: product.gstPercentage != null ? String(product.gstPercentage) : '',

      stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : '0',

      leadTimeDays: product.leadTimeDays != null ? String(product.leadTimeDays) : '7',

      minOrderQuantity:

        product.minOrderQuantity != null ? String(product.minOrderQuantity) : '1',

      priceValidTill: product.priceValidTill ?? '',

      extraInfo: product.extraInfo ?? '',

    });

    this.actionError.set(null);

    this.formOpen.set(true);

  }



  closeForm(): void {

    if (this.saving()) {

      return;

    }

    this.formOpen.set(false);

    this.editingProduct.set(null);

    this.actionError.set(null);

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

    return this.attachments().filter((attachment) => attachment.mediaType === tab).length;

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

        this.uploadFiles([file]);

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

    if (!state.brand.trim() || !state.designation.trim()) {

      this.actionError.set('Brand and designation are required.');

      return;

    }



    this.saving.set(true);

    this.actionError.set(null);



    if (this.formMode() === 'create') {

      const request = this.toCreateRequest(state);

      this.productService.create(request).subscribe({

        next: (created) => {

          this.products.update((list) => [created, ...list]);

          this.saving.set(false);

          this.formOpen.set(false);

        },

        error: (err) => {

          this.saving.set(false);

          this.actionError.set(err?.error?.message ?? 'Could not add product.');

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

    this.productService.update(editing.id, request).subscribe({

      next: (updated) => {

        this.products.update((list) =>

          list.map((item) => (item.id === updated.id ? updated : item)),

        );

        this.saving.set(false);

        this.formOpen.set(false);

      },

      error: (err) => {

        this.saving.set(false);

        this.actionError.set(err?.error?.message ?? 'Could not update product.');

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

      this.uploadFiles(validFiles);

    }

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



  private toCreateRequest(state: ProductFormState): CreateDistributorProductRequest {

    return {

      brand: state.brand.trim(),

      designation: state.designation.trim(),

      groupName: state.groupName.trim() || undefined,

      category: state.category.trim() || undefined,

      description: state.description.trim() || undefined,

      specifications: state.specifications.trim() || undefined,

      aliasNames: state.aliasNames.trim() || undefined,

      rsp: this.parseNumber(state.rsp),

      discountPercentage: this.parseNumber(state.discountPercentage),

      gstPercentage: this.parseNumber(state.gstPercentage),

      stockQuantity: this.parseInteger(state.stockQuantity, 0),

      leadTimeDays: this.parseInteger(state.leadTimeDays, 7),

      minOrderQuantity: this.parseInteger(state.minOrderQuantity, 1),

      priceValidTill: state.priceValidTill || undefined,

      extraInfo: state.extraInfo.trim() || undefined,

    };

  }



  private toUpdateRequest(state: ProductFormState): UpdateDistributorProductRequest {

    return this.toCreateRequest(state);

  }



  private parseNumber(value: string): number | undefined {

    const trimmed = value.trim();

    if (!trimmed) {

      return undefined;

    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : undefined;

  }



  private parseInteger(value: string, fallback: number): number {

    const trimmed = value.trim();

    if (!trimmed) {

      return fallback;

    }

    const parsed = Number.parseInt(trimmed, 10);

    return Number.isFinite(parsed) ? parsed : fallback;

  }

}


