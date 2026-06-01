import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product/product.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { InquiryCartService } from '../../../core/services/inquiry/inquiry-cart.service';
import { ProductQueryFormService } from '../../../core/services/product/product-query-form.service';

@Component({
  selector: 'app-product-list',
  imports: [FormsModule],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cart = inject(InquiryCartService);
  private readonly queryForm = inject(ProductQueryFormService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly products = signal<Product[]>([]);
  readonly searchLoading = signal(false);

  readonly selectedProduct = signal<Product | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly isConsumer = () => this.auth.currentUser()?.role === 'CONSUMER';

  readonly showNoMatchState = () =>
    !this.loading() && !this.searchLoading() && this.searchTerm().trim().length > 0 && this.products().length === 0;

  @HostListener('document:keydown.escape')
  onEscape(): void {
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

    this.productService.getAll().subscribe({
      next: (products) => {
        this.products.set(products);
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
    this.productService.search(term).subscribe({
      next: (products) => {
        this.products.set(products);
        this.searchLoading.set(false);
      },
      error: () => {
        this.searchLoading.set(false);
        this.errorMessage.set('Search failed. Please try again.');
      },
    });
  }

  openProductDetail(product: Product, event: Event): void {
    event.stopPropagation();
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedProduct.set(product);

    this.productService.getById(product.id).subscribe({
      next: (fullProduct) => {
        this.selectedProduct.set(fullProduct);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailError.set('Could not load product details.');
      },
    });
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
    this.detailLoading.set(false);
    this.detailError.set(null);
  }

  useInQuery(product: Product, event: Event): void {
    event.stopPropagation();
    if (!this.isConsumer()) {
      return;
    }

    const go = (p: Product) => {
      this.queryForm.fillFromProduct(p, 'CATALOG_MATCH');
      void this.router.navigate(['/requests']);
    };

    this.productService.getById(product.id).subscribe({
      next: go,
      error: () => go(product),
    });
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
}
