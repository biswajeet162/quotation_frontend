import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CatalogBrand,
  CatalogProduct,
  CatalogProductAttachment,
  toTimelineAttachment,
} from '../../../core/models/catalog-product.model';
import { TimelineAttachmentMediaType } from '../../../core/models/inquiry-timeline.model';
import { ConsumerProductCatalogService } from '../../../core/services/product/consumer-product-catalog.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { InquiryCartService } from '../../../core/services/inquiry/inquiry-cart.service';
import { ProductQueryFormService } from '../../../core/services/product/product-query-form.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { InquiryChatAttachmentComponent } from '../../../shared/components/inquiry-chat-attachment/inquiry-chat-attachment.component';

type ProductSortColumn = 'brand' | 'designation' | 'description' | 'attachmentCount';
type SortDirection = 'asc' | 'desc';

interface BrandSummary {
  brandName: string;
  productCount: number;
  logoUrl: string | null;
}

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
  private readonly cart = inject(InquiryCartService);
  private readonly queryForm = inject(ProductQueryFormService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly catalogProducts = signal<CatalogProduct[]>([]);
  readonly activeMainTab = signal<'products' | 'brands'>('products');
  readonly selectedBrand = signal<string | null>(null);
  readonly brands = signal<BrandSummary[]>([]);
  readonly sortColumn = signal<ProductSortColumn>('brand');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly selectedProduct = signal<CatalogProduct | null>(null);

  readonly attachmentPanelOpen = signal(false);
  readonly attachmentProduct = signal<CatalogProduct | null>(null);
  readonly attachments = signal<CatalogProductAttachment[]>([]);
  readonly attachmentsLoading = signal(false);
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

  readonly isConsumer = () => this.auth.currentUser()?.role === 'CONSUMER';

  readonly showNoMatchState = () =>
    !this.loading() &&
    this.activeMainTab() === 'products' &&
    this.searchQuery().trim().length > 0 &&
    this.filteredProducts().length === 0;

  private readonly brandLogoObjectUrls = new Set<string>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
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
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Failed to load products. Please try again.');
      },
    });
  }

  setMainTab(tab: 'products' | 'brands'): void {
    this.activeMainTab.set(tab);
    void this.router.navigate(['../', tab === 'products' ? 'all' : 'brands'], {
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
    return this.brands().find((brand) => brand.brandName === name)?.logoUrl ?? null;
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

  private loadBrands(): void {
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

  private syncTabFromRoute(): void {
    const lastSegment = this.route.snapshot.url.at(-1)?.path;
    if (lastSegment === 'brands') {
      this.activeMainTab.set('brands');
      return;
    }
    this.activeMainTab.set('products');
  }

  private sortProducts(
    list: CatalogProduct[],
    column: ProductSortColumn,
    direction: SortDirection,
  ): CatalogProduct[] {
    const factor = direction === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => this.compareByColumn(a, b, column) * factor);
  }

  private compareByColumn(a: CatalogProduct, b: CatalogProduct, column: ProductSortColumn): number {
    switch (column) {
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
      if (!brand.logoUrl) {
        return;
      }

      this.catalogService.fetchBrandLogoBlob(brand.logoUrl).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.brandLogoObjectUrls.add(objectUrl);
          this.brands.update((items) =>
            items.map((item) =>
              item.brandName === brand.brandName ? { ...item, logoUrl: objectUrl } : item,
            ),
          );
        },
      });
    });
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
