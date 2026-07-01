import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Product } from '../../../core/models/product.model';
import {
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

@Component({
  selector: 'app-product-list',
  imports: [FormsModule, LoadingOverlayComponent, InquiryChatAttachmentComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  private readonly catalogService = inject(ConsumerProductCatalogService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cart = inject(InquiryCartService);
  private readonly queryForm = inject(ProductQueryFormService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly catalogProducts = signal<CatalogProduct[]>([]);
  readonly searchLoading = signal(false);

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

  readonly isConsumer = () => this.auth.currentUser()?.role === 'CONSUMER';

  readonly showNoMatchState = () =>
    !this.loading() &&
    !this.searchLoading() &&
    this.searchTerm().trim().length > 0 &&
    this.catalogProducts().length === 0;

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
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.catalogService.list().subscribe({
      next: (products) => {
        this.catalogProducts.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Failed to load products. Please try again.');
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    const term = value.trim();

    if (!term) {
      this.loadProducts();
      return;
    }

    this.searchLoading.set(true);
    this.catalogService.search(term).subscribe({
      next: (products) => {
        this.catalogProducts.set(products);
        this.searchLoading.set(false);
      },
      error: () => {
        this.searchLoading.set(false);
        this.errorMessage.set('Search failed. Please try again.');
      },
    });
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

    const product: Product = {
      id: entry.productId,
      brand: entry.brand,
      designation: entry.designation,
      description: entry.description,
    };
    this.queryForm.fillFromProduct(product, 'CATALOG_MATCH');
    void this.router.navigate(['/requests']);
  }

  goToQueryFromSearch(): void {
    const term = this.searchTerm().trim();
    this.cart.setSearchTerm(term);
    this.queryForm.fillFromSearchTerm(term);
    void this.router.navigate(['/requests']);
  }

  displayValue(value: string | undefined): string {
    return value?.trim() ? value : '—';
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
