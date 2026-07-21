import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CatalogBrand,
  CatalogProduct,
  CatalogProductAttachment,
  toTimelineAttachment,
} from '../../../core/models/catalog-product.model';
import {
  InquiryTimelineAttachment,
  TimelineAttachmentMediaType,
} from '../../../core/models/inquiry-timeline.model';
import { ConsumerProductCatalogService } from '../../../core/services/product/consumer-product-catalog.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { InquiryCartService } from '../../../core/services/inquiry/inquiry-cart.service';
import { ProductQueryFormService } from '../../../core/services/product/product-query-form.service';
import { AdminDistributorProductService } from '../../../core/services/admin/admin-distributor-product.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import {
  DistributorBrand,
  DistributorProductAttachment,
  DistributorProductAuditLog,
  DistributorProductEntry,
  UpdateDistributorProductRequest,
} from '../../../core/models/distributor.model';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';

type ProductSortColumn =
  | 'brand'
  | 'designation'
  | 'description'
  | 'rsp'
  | 'stockQuantity'
  | 'isActive'
  | 'attachmentCount';
type SortDirection = 'asc' | 'desc';
type ProductMainTab = 'products' | 'brands' | 'distributors';
type SortableProduct = CatalogProduct | DistributorProductEntry;

interface BrandSummary {
  brandName: string;
  productCount: number;
  logoUrl: string | null;
}

interface AdminProductFormState {
  brand: string;
  designation: string;
  description: string;
  specifications: string;
  rsp: string | number;
  stockQuantity: string | number;
}

const emptyAdminProductForm = (): AdminProductFormState => ({
  brand: '',
  designation: '',
  description: '',
  specifications: '',
  rsp: '',
  stockQuantity: '0',
});

@Component({
  selector: 'app-product-list',
  imports: [FormsModule, LoadingOverlayComponent, InquiryChatAttachmentComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly catalogService = inject(ConsumerProductCatalogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cart = inject(InquiryCartService);
  private readonly queryForm = inject(ProductQueryFormService);
  private readonly adminProducts = inject(AdminDistributorProductService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly adminActionError = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly catalogProducts = signal<CatalogProduct[]>([]);
  readonly adminDistributorProducts = signal<DistributorProductEntry[]>([]);
  readonly statusUpdatingIds = signal<Set<string>>(new Set());
  readonly activeMainTab = signal<ProductMainTab>('products');
  readonly pageTitle = computed(() => {
    switch (this.activeMainTab()) {
      case 'brands':
        return 'Brands';
      case 'distributors':
        return 'Distributors';
      default:
        return 'Products';
    }
  });
  readonly selectedBrand = signal<string | null>(null);
  readonly selectedDistributorCompany = signal<string | null>(null);
  readonly brands = signal<BrandSummary[]>([]);
  readonly brandLogoUploading = signal<ReadonlySet<string>>(new Set());
  readonly brandLogoTarget = signal<string | null>(null);
  readonly sortColumn = signal<ProductSortColumn>('brand');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly selectedProduct = signal<CatalogProduct | null>(null);

  readonly attachmentPanelOpen = signal(false);
  readonly attachmentProduct = signal<CatalogProduct | null>(null);
  readonly attachments = signal<CatalogProductAttachment[]>([]);
  readonly attachmentsLoading = signal(false);
  readonly attachmentError = signal<string | null>(null);

  readonly adminDetailsOpen = signal(false);
  readonly adminDetailsProduct = signal<DistributorProductEntry | null>(null);
  readonly adminDetailsAttachments = signal<InquiryTimelineAttachment[]>([]);
  readonly adminDetailsLoading = signal(false);
  readonly adminDetailsError = signal<string | null>(null);
  readonly adminDetailsAttachmentTab = signal<TimelineAttachmentMediaType>('IMAGE');

  readonly adminAttachmentPanelOpen = signal(false);
  readonly adminAttachmentProduct = signal<DistributorProductEntry | null>(null);
  readonly adminAttachments = signal<InquiryTimelineAttachment[]>([]);
  readonly adminAttachmentsLoading = signal(false);
  readonly adminAttachmentsUploading = signal(false);
  readonly adminAttachmentError = signal<string | null>(null);
  readonly adminAttachmentTab = signal<TimelineAttachmentMediaType>('IMAGE');

  readonly adminEditOpen = signal(false);
  readonly adminSaving = signal(false);
  readonly adminEditingProduct = signal<DistributorProductEntry | null>(null);
  readonly adminForm = signal<AdminProductFormState>(emptyAdminProductForm());
  readonly adminEditAttachments = signal<InquiryTimelineAttachment[]>([]);
  readonly adminEditAttachmentsLoading = signal(false);
  readonly adminEditAttachmentsUploading = signal(false);
  readonly adminEditAttachmentError = signal<string | null>(null);
  readonly adminEditAttachmentTab = signal<TimelineAttachmentMediaType>('IMAGE');
  readonly adminAuditLogs = signal<DistributorProductAuditLog[]>([]);
  readonly adminAuditLogsLoading = signal(false);
  readonly adminAuditLogsError = signal<string | null>(null);

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

  readonly adminDetailsAttachmentsForActiveTab = computed(() =>
    this.adminDetailsAttachments().filter(
      (attachment) => attachment.mediaType === this.adminDetailsAttachmentTab(),
    ),
  );

  readonly adminAttachmentsForActiveTab = computed(() =>
    this.adminAttachments().filter((attachment) => attachment.mediaType === this.adminAttachmentTab()),
  );

  readonly adminEditAttachmentsForActiveTab = computed(() =>
    this.adminEditAttachments().filter(
      (attachment) => attachment.mediaType === this.adminEditAttachmentTab(),
    ),
  );

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.catalogProducts().filter((product) => {
      if (!query) {
        return true;
      }
      const haystack = [product.brand, product.designation, product.description]
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
      return [] as CatalogProduct[];
    }
    const list = this.catalogProducts().filter((product) => (product.brand ?? '').trim() === brand);
    return this.sortProducts(list, this.sortColumn(), this.sortDirection());
  });

  readonly selectedAdminBrandProducts = computed(() => {
    const brand = this.selectedBrand();
    if (!brand) {
      return [] as DistributorProductEntry[];
    }
    const list = this.adminDistributorProducts().filter(
      (product) => (product.brand ?? '').trim() === brand,
    );
    return this.sortProducts(list, this.sortColumn(), this.sortDirection());
  });

  readonly isConsumer = () => this.auth.currentUser()?.role === 'CONSUMER';
  readonly isAdmin = () => this.auth.currentUser()?.role === 'ADMIN';

  readonly filteredAdminDistributorProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const company = this.activeMainTab() === 'distributors' ? this.selectedDistributorCompany() : null;
    return this.adminDistributorProducts().filter((product) => {
      if (company && product.companyId !== company) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        product.companyName,
        product.brand,
        product.designation,
        product.description,
        product.specifications,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly sortedFilteredAdminDistributorProducts = computed(() =>
    this.sortProducts(
      this.filteredAdminDistributorProducts(),
      this.sortColumn(),
      this.sortDirection(),
    ),
  );

  readonly adminDistributorCompanies = computed(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const product of this.adminDistributorProducts()) {
      const id = product.companyId ?? 'unknown';
      const name = product.companyName?.trim() || 'Unknown distributor';
      const current = map.get(id);
      if (current) {
        current.count++;
      } else {
        map.set(id, { id, name, count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly showNoMatchState = () =>
    !this.loading() &&
    this.activeMainTab() === 'products' &&
    !this.isAdmin() &&
    this.searchQuery().trim().length > 0 &&
    this.filteredProducts().length === 0;

  private readonly brandLogoObjectUrls = new Set<string>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.adminEditOpen()) {
      this.closeAdminEdit();
      return;
    }
    if (this.adminAttachmentPanelOpen()) {
      this.closeAdminAttachments();
      return;
    }
    if (this.adminDetailsOpen()) {
      this.closeAdminDetails();
      return;
    }
    if (this.attachmentPanelOpen()) {
      this.closeAttachments();
      return;
    }
    if (this.selectedProduct() !== null) {
      this.closeDetail();
    }
  }

  ngOnInit(): void {
    this.syncTabFromRoute();
    this.route.url.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.syncTabFromRoute();
    });
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.clearBrandLogoObjectUrls();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.catalogService.list().subscribe({
      next: (products) => {
        this.catalogProducts.set(products);
        this.loadBrands();
        this.loadAdminDistributorProducts();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Failed to load products. Please try again.');
      },
    });
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

  onAdminBrandLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const brandName = this.brandLogoTarget();
    input.value = '';

    if (!brandName || !file || !this.isAdmin()) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Please select an image file for brand logo.');
      this.toast.warning('Please select an image file for brand logo.');
      return;
    }

    this.errorMessage.set(null);
    this.brandLogoUploading.update((items) => new Set(items).add(brandName));
    this.adminProducts.uploadBrandLogo(brandName, file).subscribe({
      next: (brand) => {
        this.brandLogoUploading.update((items) => {
          const next = new Set(items);
          next.delete(brandName);
          return next;
        });
        this.brandLogoTarget.set(null);
        this.applyUploadedBrandLogo({ ...brand, brandName: brand.brandName || brandName }, file);
        this.toast.success('Brand logo updated.');
      },
      error: (err) => {
        this.brandLogoUploading.update((items) => {
          const next = new Set(items);
          next.delete(brandName);
          return next;
        });
        this.errorMessage.set(err?.error?.message ?? 'Could not update brand logo.');
        this.toast.fromApiError(err, 'Could not update brand logo.');
      },
    });
  }

  selectDistributorCompany(companyId: string | null): void {
    this.selectedDistributorCompany.set(companyId);
  }

  getBrandInitials(brandName: string): string {
    const value = brandName.trim();
    if (!value) {
      return '?';
    }
    return value.slice(0, 2).toUpperCase();
  }

  getBrandLogoUrl(brandName: string | null | undefined): string | null {
    const name = brandName?.trim();
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

  openProductDetail(entry: CatalogProduct, event: Event): void {
    event.stopPropagation();
    this.selectedProduct.set(entry);
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
  }

  openAttachments(entry: CatalogProduct, event: Event): void {
    event.stopPropagation();
    this.attachmentProduct.set(entry);
    this.attachmentPanelOpen.set(true);
    this.attachmentError.set(null);
    this.activeAttachmentTab.set('IMAGE');
    this.loadAttachments(entry.productId);
  }

  closeAttachments(): void {
    this.attachmentPanelOpen.set(false);
    this.attachmentProduct.set(null);
    this.attachments.set([]);
    this.attachmentError.set(null);
    this.activeAttachmentTab.set('IMAGE');
  }

  setAttachmentTab(tab: TimelineAttachmentMediaType): void {
    this.activeAttachmentTab.set(tab);
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

  toTimelineAttachment(attachment: CatalogProductAttachment) {
    return toTimelineAttachment(attachment);
  }

  toProductTimelineAttachment(attachment: DistributorProductAttachment): InquiryTimelineAttachment {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      mediaType: attachment.mediaType,
      url: this.resolveAdminAttachmentUrl(attachment.url),
    };
  }

  useInQuery(entry: CatalogProduct, event: Event): void {
    event.stopPropagation();
    if (!this.isConsumer()) {
      return;
    }

    this.queryForm.fillFromCatalogProduct(entry, 'CATALOG_MATCH');
    void this.router.navigate(['/requests']);
  }

  goToQueryFromSearch(): void {
    const term = this.searchQuery().trim();
    this.cart.setSearchTerm(term);
    this.queryForm.fillFromSearchTerm(term);
    void this.router.navigate(['/requests']);
  }

  displayValue(value: string | undefined): string {
    return value?.trim() ? value : '—';
  }

  formatCurrency(value?: number): string {
    return value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  formatPercent(value?: number): string {
    return value == null ? '—' : `${value}%`;
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  formatAuditAction(action: string): string {
    return action
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  isStatusUpdating(productId: string): boolean {
    return this.statusUpdatingIds().has(productId);
  }

  isTogglingActive(productId: string): boolean {
    return this.isStatusUpdating(productId);
  }

  onActiveToggle(product: DistributorProductEntry): void {
    this.toggleAdminProductStatus(product);
  }

  toggleAdminProductStatus(product: DistributorProductEntry, event?: Event): void {
    event?.stopPropagation();
    if (!this.isAdmin() || this.isStatusUpdating(product.id)) {
      return;
    }

    this.statusUpdatingIds.update((ids) => new Set(ids).add(product.id));
    const request =
      product.isActive === false
        ? this.adminProducts.activate(product.id)
        : this.adminProducts.deactivate(product.id);

    request.subscribe({
      next: () => {
        const nextActive = product.isActive === false;
        this.adminDistributorProducts.update((list) =>
          list.map((item) => (item.id === product.id ? { ...item, isActive: nextActive } : item)),
        );
        this.adminDetailsProduct.update((item) =>
          item?.id === product.id ? { ...item, isActive: nextActive } : item,
        );
        this.statusUpdatingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(product.id);
          return next;
        });
        this.loadAdminAuditLogs(product.id);
        this.toast.success(nextActive ? 'Product activated.' : 'Product deactivated.');
      },
      error: (err) => {
        this.statusUpdatingIds.update((ids) => {
          const next = new Set(ids);
          next.delete(product.id);
          return next;
        });
        this.toast.fromApiError(err, 'Could not update product status.');
      },
    });
  }

  openAdminDetails(product: DistributorProductEntry): void {
    this.adminDetailsProduct.set(product);
    this.adminDetailsOpen.set(true);
    this.adminDetailsError.set(null);
    this.adminDetailsAttachmentTab.set('IMAGE');
    this.loadAdminDetailsAttachments(product.id);
  }

  closeAdminDetails(): void {
    this.adminDetailsOpen.set(false);
    this.adminDetailsProduct.set(null);
    this.adminDetailsAttachments.set([]);
    this.adminDetailsError.set(null);
    this.adminDetailsAttachmentTab.set('IMAGE');
  }

  setAdminDetailsAttachmentTab(tab: TimelineAttachmentMediaType): void {
    this.adminDetailsAttachmentTab.set(tab);
  }

  adminDetailsAttachmentCountFor(tab: TimelineAttachmentMediaType): number {
    return this.adminDetailsAttachments().filter((attachment) => attachment.mediaType === tab).length;
  }

  adminDetailsAttachmentTabLabel(): string {
    return (
      this.attachmentTabOptions.find((tab) => tab.type === this.adminDetailsAttachmentTab())?.label ??
      'Attachments'
    );
  }

  openAdminAttachments(product: DistributorProductEntry, event: Event): void {
    event.stopPropagation();
    this.adminAttachmentProduct.set(product);
    this.adminAttachmentPanelOpen.set(true);
    this.adminAttachmentError.set(null);
    this.adminAttachmentTab.set('IMAGE');
    this.loadAdminAttachments(product.id);
  }

  closeAdminAttachments(): void {
    if (this.adminAttachmentsUploading()) {
      return;
    }
    this.adminAttachmentPanelOpen.set(false);
    this.adminAttachmentProduct.set(null);
    this.adminAttachments.set([]);
    this.adminAttachmentError.set(null);
    this.adminAttachmentTab.set('IMAGE');
  }

  setAdminAttachmentTab(tab: TimelineAttachmentMediaType): void {
    this.adminAttachmentTab.set(tab);
  }

  adminAttachmentCountFor(tab: TimelineAttachmentMediaType): number {
    return this.adminAttachments().filter((attachment) => attachment.mediaType === tab).length;
  }

  adminAttachmentTabLabel(): string {
    return (
      this.attachmentTabOptions.find((tab) => tab.type === this.adminAttachmentTab())?.label ??
      'Attachments'
    );
  }

  onAdminPanelImageSelected(event: Event): void {
    this.onAdminPanelFilesSelected(event);
  }

  onAdminPanelVideoSelected(event: Event): void {
    this.onAdminPanelFilesSelected(event);
  }

  onAdminPanelDocumentSelected(event: Event): void {
    this.onAdminPanelFilesSelected(event);
  }

  deleteAdminAttachment(attachment: InquiryTimelineAttachment): void {
    const product = this.adminAttachmentProduct();
    if (!product || this.adminAttachmentsUploading()) {
      return;
    }

    this.adminAttachmentsUploading.set(true);
    this.adminAttachmentError.set(null);
    this.adminProducts.deleteAttachment(attachment.id).subscribe({
      next: () => {
        this.adminAttachments.update((items) => items.filter((item) => item.id !== attachment.id));
        this.updateAdminAttachmentCount(product.id, this.adminAttachments().length);
        this.adminAttachmentsUploading.set(false);
        this.loadAdminAuditLogs(product.id);
        this.toast.success('Attachment deleted.');
      },
      error: (err) => {
        this.adminAttachmentsUploading.set(false);
        this.adminAttachmentError.set('Could not delete attachment.');
        this.toast.fromApiError(err, 'Could not delete attachment.');
      },
    });
  }

  openAdminEdit(product: DistributorProductEntry, event?: Event): void {
    event?.stopPropagation();
    this.adminEditingProduct.set(product);
    this.adminForm.set({
      brand: product.brand ?? '',
      designation: product.designation ?? '',
      description: product.description ?? '',
      specifications: product.specifications ?? '',
      rsp: product.rsp != null ? String(product.rsp) : '',
      stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : '0',
    });
    this.adminActionError.set(null);
    this.adminEditAttachmentError.set(null);
    this.adminEditAttachmentTab.set('IMAGE');
    this.adminEditOpen.set(true);
    this.loadAdminEditAttachments(product.id);
    this.loadAdminAuditLogs(product.id);
  }

  closeAdminEdit(): void {
    if (this.adminSaving() || this.adminEditAttachmentsUploading()) {
      return;
    }
    this.adminEditOpen.set(false);
    this.adminEditingProduct.set(null);
    this.adminForm.set(emptyAdminProductForm());
    this.adminActionError.set(null);
    this.adminEditAttachmentError.set(null);
    this.adminEditAttachments.set([]);
    this.adminEditAttachmentTab.set('IMAGE');
    this.adminAuditLogs.set([]);
    this.adminAuditLogsError.set(null);
  }

  updateAdminFormField<K extends keyof AdminProductFormState>(
    field: K,
    value: AdminProductFormState[K],
  ): void {
    this.adminForm.update((form) => ({ ...form, [field]: value }));
  }

  setAdminEditAttachmentTab(tab: TimelineAttachmentMediaType): void {
    this.adminEditAttachmentTab.set(tab);
    this.adminEditAttachmentError.set(null);
  }

  adminEditAttachmentCountFor(tab: TimelineAttachmentMediaType): number {
    return this.adminEditAttachments().filter((attachment) => attachment.mediaType === tab).length;
  }

  adminEditAttachmentTabLabel(): string {
    return (
      this.attachmentTabOptions.find((tab) => tab.type === this.adminEditAttachmentTab())?.label ??
      'Attachments'
    );
  }

  saveAdminEdit(): void {
    const product = this.adminEditingProduct();
    const form = this.adminForm();
    const brand = String(form.brand).trim();
    const designation = String(form.designation).trim();
    const rsp = this.parseNumber(form.rsp);

    if (!product) {
      return;
    }
    if (!brand || !designation || rsp == null) {
      this.adminActionError.set('Brand, designation, and RSP are required.');
      this.toast.warning('Brand, designation, and RSP are required.');
      return;
    }

    const request: UpdateDistributorProductRequest = {
      brand,
      designation,
      description: String(form.description ?? '').trim() || undefined,
      specifications: String(form.specifications ?? '').trim() || undefined,
      rsp,
      stockQuantity: this.parseInteger(form.stockQuantity, 0),
    };

    this.adminSaving.set(true);
    this.adminActionError.set(null);
    this.adminProducts.update(product.id, request).subscribe({
      next: (updated) => {
        const attachmentCount = this.adminEditAttachments().length;
        const merged = { ...updated, attachmentCount };
        this.updateAdminProduct(merged);
        this.adminEditOpen.set(false);
        this.adminEditingProduct.set(null);
        this.adminEditAttachments.set([]);
        this.adminSaving.set(false);
        this.loadBrands();
        this.loadAdminAuditLogs(product.id);
        this.toast.success('Product updated successfully.');
      },
      error: (err) => {
        this.adminSaving.set(false);
        this.adminActionError.set(err?.error?.message ?? 'Could not update product. Please try again.');
        this.toast.fromApiError(err, 'Could not update product. Please try again.');
      },
    });
  }

  onAdminImageSelected(event: Event): void {
    this.onAdminFilesSelected(event);
  }

  onAdminVideoSelected(event: Event): void {
    this.onAdminFilesSelected(event);
  }

  onAdminDocumentSelected(event: Event): void {
    this.onAdminFilesSelected(event);
  }

  deleteAdminEditAttachment(attachment: InquiryTimelineAttachment): void {
    const product = this.adminEditingProduct();
    if (!product || this.adminEditAttachmentsUploading()) {
      return;
    }

    this.adminEditAttachmentsUploading.set(true);
    this.adminEditAttachmentError.set(null);
    this.adminProducts.deleteAttachment(attachment.id).subscribe({
      next: () => {
        this.adminEditAttachments.update((items) => items.filter((item) => item.id !== attachment.id));
        this.updateAdminAttachmentCount(product.id, this.adminEditAttachments().length);
        this.adminEditAttachmentsUploading.set(false);
        this.loadAdminAuditLogs(product.id);
        this.toast.success('Attachment deleted.');
      },
      error: (err) => {
        this.adminEditAttachmentsUploading.set(false);
        this.adminEditAttachmentError.set('Could not delete attachment.');
        this.toast.fromApiError(err, 'Could not delete attachment.');
      },
    });
  }

  private loadBrands(): void {
    if (this.isAdmin()) {
      this.clearBrandLogoObjectUrls();
      this.catalogService.listBrands().subscribe({
        next: (brandList) => {
          this.brands.set(
            brandList
              .map((brand: CatalogBrand) => ({
                brandName: brand.brandName?.trim() ?? '',
                productCount: brand.productCount ?? 0,
                logoUrl: brand.logoUrl ?? null,
              }))
              .filter((brand) => !!brand.brandName),
          );
          this.buildAdminBrands();
        },
        error: () => {
          this.buildAdminBrands();
        },
      });
      return;
    }

    this.clearBrandLogoObjectUrls();
    this.catalogService.listBrands().subscribe({
      next: (brandList) => {
        const normalized: BrandSummary[] = brandList
          .map((brand: CatalogBrand) => ({
            brandName: brand.brandName?.trim() ?? '',
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

  private buildAdminBrands(): void {
    const existingLogos = new Map(
      this.brands().map((brand) => [this.normalizeBrandName(brand.brandName), brand.logoUrl] as const),
    );
    const counts = new Map<string, number>();
    for (const product of this.adminDistributorProducts()) {
      const brandName = product.brand?.trim();
      if (!brandName) {
        continue;
      }
      counts.set(brandName, (counts.get(brandName) ?? 0) + 1);
    }

    const normalized: BrandSummary[] = [...counts.entries()]
      .map(([brandName, productCount]) => ({
        brandName,
        productCount,
        logoUrl: existingLogos.get(this.normalizeBrandName(brandName)) ?? this.getBrandLogoUrl(brandName),
      }))
      .sort((a, b) => a.brandName.localeCompare(b.brandName));

    this.brands.set(normalized);

    const selected = this.selectedBrand();
    const stillExists = normalized.some((brand) => brand.brandName === selected);
    if (!stillExists) {
      this.selectedBrand.set(normalized[0]?.brandName ?? null);
    }

    this.resolveBrandLogoPreviews();
  }

  private syncTabFromRoute(): void {
    const lastSegment = this.route.snapshot.url.at(-1)?.path;
    if (lastSegment === 'distributors' && this.isAdmin()) {
      this.activeMainTab.set('distributors');
      return;
    }
    if (lastSegment === 'brands') {
      this.activeMainTab.set('brands');
      if (!this.selectedBrand() && this.brands().length > 0) {
        this.selectedBrand.set(this.brands()[0].brandName);
      }
      return;
    }
    this.activeMainTab.set('products');
  }

  private loadAdminDistributorProducts(): void {
    if (!this.isAdmin()) {
      this.adminDistributorProducts.set([]);
      return;
    }
    this.adminProducts.listAll().subscribe({
      next: (products) => {
        this.adminDistributorProducts.set(products);
        this.buildAdminBrands();
        const selected = this.selectedDistributorCompany();
        const stillExists = products.some((product) => product.companyId === selected);
        if (!stillExists) {
          this.selectedDistributorCompany.set(null);
        }
      },
      error: () => {
        this.adminDistributorProducts.set([]);
      },
    });
  }

  private loadAdminAttachments(productId: string): void {
    this.adminAttachmentsLoading.set(true);
    this.adminAttachmentError.set(null);
    this.adminProducts.listAttachments(productId).subscribe({
      next: (attachments) => {
        const mapped = attachments.map((attachment) => this.toProductTimelineAttachment(attachment));
        this.adminAttachments.set(mapped);
        this.adminAttachmentsLoading.set(false);
        this.selectInitialAdminAttachmentTab(mapped, this.adminAttachmentTab);
      },
      error: () => {
        this.adminAttachmentsLoading.set(false);
        this.adminAttachmentError.set('Could not load attachments.');
      },
    });
  }

  private loadAdminEditAttachments(productId: string): void {
    this.adminEditAttachmentsLoading.set(true);
    this.adminEditAttachmentError.set(null);
    this.adminProducts.listAttachments(productId).subscribe({
      next: (attachments) => {
        const mapped = attachments.map((attachment) => this.toProductTimelineAttachment(attachment));
        this.adminEditAttachments.set(mapped);
        this.adminEditAttachmentsLoading.set(false);
        this.updateAdminAttachmentCount(productId, mapped.length);
        this.selectInitialAdminAttachmentTab(mapped, this.adminEditAttachmentTab);
      },
      error: () => {
        this.adminEditAttachmentsLoading.set(false);
        this.adminEditAttachmentError.set('Could not load attachments.');
      },
    });
  }

  private loadAdminDetailsAttachments(productId: string): void {
    this.adminDetailsLoading.set(true);
    this.adminDetailsError.set(null);
    this.adminProducts.listAttachments(productId).subscribe({
      next: (attachments) => {
        const mapped = attachments.map((attachment) => this.toProductTimelineAttachment(attachment));
        this.adminDetailsAttachments.set(mapped);
        this.adminDetailsLoading.set(false);
        this.selectInitialAdminAttachmentTab(mapped, this.adminDetailsAttachmentTab);
      },
      error: () => {
        this.adminDetailsLoading.set(false);
        this.adminDetailsError.set('Could not load product details.');
      },
    });
  }

  loadAdminAuditLogs(productId: string): void {
    if (!this.isAdmin()) {
      this.adminAuditLogs.set([]);
      return;
    }
    this.adminAuditLogsLoading.set(true);
    this.adminAuditLogsError.set(null);
    this.adminProducts.listAuditLogs(productId).subscribe({
      next: (logs) => {
        this.adminAuditLogs.set(logs);
        this.adminAuditLogsLoading.set(false);
      },
      error: () => {
        this.adminAuditLogs.set([]);
        this.adminAuditLogsLoading.set(false);
        this.adminAuditLogsError.set('Could not load product change logs.');
      },
    });
  }

  private onAdminFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.uploadAdminEditFiles(files);
  }

  private onAdminPanelFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.uploadAdminPanelFiles(files);
  }

  private uploadAdminEditFiles(files: File[]): void {
    const product = this.adminEditingProduct();
    if (!product || files.length === 0) {
      return;
    }

    this.adminEditAttachmentsUploading.set(true);
    this.adminEditAttachmentError.set(null);
    this.adminProducts.uploadAttachments(product.id, files).subscribe({
      next: (uploaded) => {
        const mapped = uploaded.map((attachment) => this.toProductTimelineAttachment(attachment));
        this.adminEditAttachments.update((items) => [...items, ...mapped]);
        this.updateAdminAttachmentCount(product.id, this.adminEditAttachments().length);
        if (mapped.length > 0) {
          this.adminEditAttachmentTab.set(mapped[0].mediaType);
        }
        this.adminEditAttachmentsUploading.set(false);
        this.loadAdminAuditLogs(product.id);
        this.toast.success(mapped.length === 1 ? 'Attachment uploaded.' : 'Attachments uploaded.');
      },
      error: (err) => {
        this.adminEditAttachmentsUploading.set(false);
        this.adminEditAttachmentError.set(err?.error?.message ?? 'Could not upload attachment.');
        this.toast.fromApiError(err, 'Could not upload attachment.');
      },
    });
  }

  private uploadAdminPanelFiles(files: File[]): void {
    const product = this.adminAttachmentProduct();
    if (!product || files.length === 0) {
      return;
    }

    this.adminAttachmentsUploading.set(true);
    this.adminAttachmentError.set(null);
    this.adminProducts.uploadAttachments(product.id, files).subscribe({
      next: (uploaded) => {
        const mapped = uploaded.map((attachment) => this.toProductTimelineAttachment(attachment));
        this.adminAttachments.update((items) => [...items, ...mapped]);
        this.updateAdminAttachmentCount(product.id, this.adminAttachments().length);
        if (mapped.length > 0) {
          this.adminAttachmentTab.set(mapped[0].mediaType);
        }
        this.adminAttachmentsUploading.set(false);
        this.loadAdminAuditLogs(product.id);
        this.toast.success(mapped.length === 1 ? 'Attachment uploaded.' : 'Attachments uploaded.');
      },
      error: (err) => {
        this.adminAttachmentsUploading.set(false);
        this.adminAttachmentError.set(err?.error?.message ?? 'Could not upload attachment.');
        this.toast.fromApiError(err, 'Could not upload attachment.');
      },
    });
  }

  private updateAdminProduct(updated: DistributorProductEntry): void {
    this.adminDistributorProducts.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
    this.adminDetailsProduct.update((item) => (item?.id === updated.id ? updated : item));
    this.adminAttachmentProduct.update((item) => (item?.id === updated.id ? updated : item));
  }

  private updateAdminAttachmentCount(productId: string, count: number): void {
    this.adminDistributorProducts.update((list) =>
      list.map((item) => (item.id === productId ? { ...item, attachmentCount: count } : item)),
    );
    this.adminEditingProduct.update((item) =>
      item?.id === productId ? { ...item, attachmentCount: count } : item,
    );
    this.adminDetailsProduct.update((item) =>
      item?.id === productId ? { ...item, attachmentCount: count } : item,
    );
    this.adminAttachmentProduct.update((item) =>
      item?.id === productId ? { ...item, attachmentCount: count } : item,
    );
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
    this.catalogService.fetchBrandLogoBlob(this.withCacheBust(brand.logoUrl)).subscribe({
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

  private sortProducts<T extends SortableProduct>(
    list: T[],
    column: ProductSortColumn,
    direction: SortDirection,
  ): T[] {
    const factor = direction === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => this.compareByColumn(a, b, column) * factor);
  }

  private compareByColumn(a: SortableProduct, b: SortableProduct, column: ProductSortColumn): number {
    switch (column) {
      case 'rsp':
        return ((a as DistributorProductEntry).rsp ?? 0) - ((b as DistributorProductEntry).rsp ?? 0);
      case 'stockQuantity':
        return (
          ((a as DistributorProductEntry).stockQuantity ?? 0) -
          ((b as DistributorProductEntry).stockQuantity ?? 0)
        );
      case 'isActive':
        return (
          Number((a as DistributorProductEntry).isActive ?? false) -
          Number((b as DistributorProductEntry).isActive ?? false)
        );
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

  private selectInitialAdminAttachmentTab(
    attachments: InquiryTimelineAttachment[],
    tabSignal: WritableSignal<TimelineAttachmentMediaType>,
  ): void {
    const firstWithItems = this.attachmentTabOptions
      .map((tab) => tab.type)
      .find((type) => attachments.some((attachment) => attachment.mediaType === type));
    tabSignal.set(firstWithItems ?? 'IMAGE');
  }

  private parseNumber(value: string | number | null | undefined): number | undefined {
    if (value === null || value === undefined || String(value).trim() === '') {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseInteger(value: string | number | null | undefined, fallback: number): number {
    const parsed = this.parseNumber(value);
    return parsed === undefined ? fallback : Math.max(0, Math.trunc(parsed));
  }

  private resolveAdminAttachmentUrl(url: string): string {
    if (url.startsWith('/admin/distributor-products/attachments/')) {
      return url;
    }
    if (url.startsWith('/distributor-products/attachments/')) {
      return url.replace('/distributor-products/attachments/', '/admin/distributor-products/attachments/');
    }
    return url;
  }

  private resolveBrandLogoPreviews(): void {
    this.brands().forEach((brand) => {
      if (!brand.logoUrl || brand.logoUrl.startsWith('blob:')) {
        return;
      }

      this.catalogService.fetchBrandLogoBlob(this.withCacheBust(brand.logoUrl)).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.brandLogoObjectUrls.add(objectUrl);
          this.updateBrandLogoPreview(brand.brandName, objectUrl);
        },
      });
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
    return (brandName ?? '').trim().toLowerCase();
  }

  private withCacheBust(url: string): string {
    if (url.startsWith('blob:')) {
      return url;
    }
    return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  }

  private clearBrandLogoObjectUrls(): void {
    this.brandLogoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.brandLogoObjectUrls.clear();
  }

  private loadAttachments(productId: string): void {
    this.attachmentsLoading.set(true);
    this.attachmentError.set(null);

    this.catalogService.listAttachments(productId).subscribe({
      next: (list) => {
        this.attachments.set(list);
        this.attachmentsLoading.set(false);
        this.selectInitialAttachmentTab(list);
      },
      error: () => {
        this.attachmentsLoading.set(false);
        this.attachmentError.set('Could not load attachments.');
      },
    });
  }

  private selectInitialAttachmentTab(list: CatalogProductAttachment[]): void {
    const order: TimelineAttachmentMediaType[] = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'];
    const firstWithItems = order.find((type) => list.some((attachment) => attachment.mediaType === type));
    this.activeAttachmentTab.set(firstWithItems ?? 'IMAGE');
  }
}
