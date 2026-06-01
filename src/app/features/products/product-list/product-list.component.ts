import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
}
