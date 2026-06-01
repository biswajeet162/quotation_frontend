import { Injectable, inject, signal } from '@angular/core';
import { Product } from '../../models/product.model';
import { ProductService } from './product.service';

export type ProductSuggestField =
  | 'brand'
  | 'designation'
  | 'groupName'
  | 'category'
  | 'description'
  | 'specifications';

const MAX_SUGGESTIONS = 12;

type FieldIndex = Record<ProductSuggestField, string[]>;

const emptyIndex = (): FieldIndex => ({
  brand: [],
  designation: [],
  groupName: [],
  category: [],
  description: [],
  specifications: [],
});

@Injectable({ providedIn: 'root' })
export class ProductCatalogLookupService {
  private readonly productService = inject(ProductService);

  private readonly indexSignal = signal<FieldIndex>(emptyIndex());
  private readonly loadedSignal = signal(false);
  private loadStarted = false;

  readonly loaded = this.loadedSignal.asReadonly();

  ensureLoaded(): void {
    if (this.loadedSignal() || this.loadStarted) {
      return;
    }
    this.loadStarted = true;
    this.productService.getAll().subscribe({
      next: (products) => {
        this.indexSignal.set(this.buildIndex(products));
        this.loadedSignal.set(true);
      },
      error: () => {
        this.loadStarted = false;
      },
    });
  }

  /** Suggestions for one field only (all values on focus, filtered while typing). */
  suggest(field: ProductSuggestField, term: string): string[] {
    const values = this.indexSignal()[field];
    const query = term.trim().toLowerCase();

    if (!query) {
      return values.slice(0, MAX_SUGGESTIONS);
    }

    return values.filter((value) => value.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }

  private buildIndex(products: Product[]): FieldIndex {
    const sets: Record<ProductSuggestField, Set<string>> = {
      brand: new Set(),
      designation: new Set(),
      groupName: new Set(),
      category: new Set(),
      description: new Set(),
      specifications: new Set(),
    };

    for (const product of products) {
      this.add(sets.brand, product.brand);
      this.add(sets.designation, product.designation);
      this.add(sets.groupName, product.groupName);
      this.add(sets.category, product.category);
      this.add(sets.description, product.description);
      this.add(sets.specifications, product.specifications);
    }

    const sort = (values: Set<string>) =>
      [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return {
      brand: sort(sets.brand),
      designation: sort(sets.designation),
      groupName: sort(sets.groupName),
      category: sort(sets.category),
      description: sort(sets.description),
      specifications: sort(sets.specifications),
    };
  }

  private add(set: Set<string>, value: string | undefined): void {
    const trimmed = value?.trim();
    if (trimmed) {
      set.add(trimmed);
    }
  }
}
