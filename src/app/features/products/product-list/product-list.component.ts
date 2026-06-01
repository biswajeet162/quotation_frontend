import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product/product.service';

@Component({
  selector: 'app-product-list',
  imports: [FormsModule],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css',
})
export class ProductListComponent implements OnInit {
  private readonly productService = inject(ProductService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');
  readonly products = signal<Product[]>([]);

  readonly selectedProduct = signal<Product | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);

  readonly filteredProducts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.products();

    if (!term) {
      return items;
    }

    return items.filter(
      (p) =>
        p.brand?.toLowerCase().includes(term) ||
        p.designation?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term) ||
        p.groupName?.toLowerCase().includes(term) ||
        p.aliasNames?.toLowerCase().includes(term),
    );
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.selectedProduct() !== null || this.detailLoading()) {
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
  }

  openProductDetail(product: Product): void {
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

  displayValue(value: string | undefined): string {
    return value?.trim() ? value : '—';
  }
}
