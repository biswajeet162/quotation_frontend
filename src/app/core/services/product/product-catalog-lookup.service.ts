import { Injectable, inject, signal } from '@angular/core';
import { specificationSuggestionLabels } from '../../../shared/utils/specifications-display.util';
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
  private readonly brandDesignationsSignal = signal<ReadonlyMap<string, string[]>>(new Map());
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
        const { index, brandDesignations } = this.buildIndex(products);
        this.indexSignal.set(index);
        this.brandDesignationsSignal.set(brandDesignations);
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

  /** Designation suggestions, optionally limited to a brand from the catalog. */
  suggestDesignation(term: string, brand?: string): string[] {
    const brandKey = brand?.trim().toLowerCase();
    let values = this.indexSignal().designation;
    if (brandKey && brandKey.length > 0) {
      const brandSpecific = this.brandDesignationsSignal().get(brandKey);
      if (brandSpecific && brandSpecific.length > 0) {
        values = brandSpecific;
      }
    }
    const query = term.trim().toLowerCase();

    if (!query) {
      return values.slice(0, MAX_SUGGESTIONS);
    }

    return values.filter((value) => value.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }

  private buildIndex(products: Product[]): {
    index: FieldIndex;
    brandDesignations: ReadonlyMap<string, string[]>;
  } {
    const sets: Record<ProductSuggestField, Set<string>> = {
      brand: new Set(),
      designation: new Set(),
      groupName: new Set(),
      category: new Set(),
      description: new Set(),
      specifications: new Set(),
    };
    const brandDesignationSets = new Map<string, Set<string>>();

    for (const product of products) {
      this.add(sets.brand, product.brand);
      this.add(sets.designation, product.designation);
      this.add(sets.groupName, product.groupName);
      this.add(sets.category, product.category);
      this.add(sets.description, product.description);
      for (const label of specificationSuggestionLabels(product.specifications)) {
        sets.specifications.add(label);
      }

      const brand = product.brand?.trim();
      const designation = product.designation?.trim();
      if (brand && designation) {
        const key = brand.toLowerCase();
        if (!brandDesignationSets.has(key)) {
          brandDesignationSets.set(key, new Set());
        }
        brandDesignationSets.get(key)!.add(designation);
      }
    }

    const sort = (values: Set<string>) =>
      [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const brandDesignations = new Map<string, string[]>();
    for (const [key, designations] of brandDesignationSets) {
      brandDesignations.set(key, sort(designations));
    }

    return {
      index: {
        brand: sort(sets.brand),
        designation: sort(sets.designation),
        groupName: sort(sets.groupName),
        category: sort(sets.category),
        description: sort(sets.description),
        specifications: sort(sets.specifications),
      },
      brandDesignations,
    };
  }

  private add(set: Set<string>, value: string | undefined): void {
    const trimmed = value?.trim();
    if (trimmed) {
      set.add(trimmed);
    }
  }
}
