import { Injectable, inject, signal } from '@angular/core';
import { specificationSuggestionLabels } from '../../../shared/utils/specifications-display.util';
import { CatalogBrand } from '../../models/catalog-product.model';
import { Product } from '../../models/product.model';
import { ConsumerProductCatalogService } from './consumer-product-catalog.service';
import { ProductService } from './product.service';

export type ProductSuggestField =
  | 'brand'
  | 'designation'
  | 'description'
  | 'specifications';

export interface CatalogBrandOption {
  brandName: string;
  logoUrl: string | null;
}

const MAX_FILTERED_SUGGESTIONS = 80;

type FieldIndex = Record<ProductSuggestField, string[]>;

const emptyIndex = (): FieldIndex => ({
  brand: [],
  designation: [],
  description: [],
  specifications: [],
});

@Injectable({ providedIn: 'root' })
export class ProductCatalogLookupService {
  private readonly productService = inject(ProductService);
  private readonly consumerCatalog = inject(ConsumerProductCatalogService);

  private readonly indexSignal = signal<FieldIndex>(emptyIndex());
  private readonly brandDesignationsSignal = signal<ReadonlyMap<string, string[]>>(new Map());
  private readonly brandOptionsSignal = signal<CatalogBrandOption[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);
  private readonly brandsLoadedSignal = signal(false);
  private loadStarted = false;
  private brandsLoadStarted = false;
  private readonly brandLogoObjectUrls = new Set<string>();

  readonly loaded = this.loadedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly brandsLoaded = this.brandsLoadedSignal.asReadonly();

  ensureLoaded(): void {
    if (this.loadedSignal() || this.loadStarted) {
      return;
    }
    this.loadStarted = true;
    this.loadingSignal.set(true);

    this.productService.getAll().subscribe({
      next: (products) => {
        const { index, brandDesignations } = this.buildIndex(products);
        this.indexSignal.set(index);
        this.brandDesignationsSignal.set(brandDesignations);
        this.loadedSignal.set(true);
        this.loadingSignal.set(false);
        if (this.brandsLoadedSignal() && this.brandOptionsSignal().length === 0) {
          this.brandOptionsSignal.set(this.fallbackBrandOptions());
        }
      },
      error: () => {
        this.loadStarted = false;
        this.loadingSignal.set(false);
      },
    });
  }

  ensureConsumerBrandsLoaded(): void {
    if (this.brandsLoadedSignal() || this.brandsLoadStarted) {
      return;
    }
    this.brandsLoadStarted = true;

    this.consumerCatalog.listBrands().subscribe({
      next: (brands) => {
        const normalized = brands
          .map((brand: CatalogBrand) => ({
            brandName: brand.brandName?.trim() ?? '',
            logoUrl: brand.logoUrl ?? null,
          }))
          .filter((brand) => !!brand.brandName)
          .sort((a, b) => a.brandName.localeCompare(b.brandName));

        this.brandOptionsSignal.set(normalized);
        this.brandsLoadedSignal.set(true);
        this.resolveBrandLogoPreviews();
      },
      error: () => {
        this.brandsLoadStarted = false;
        if (this.loadedSignal()) {
          this.brandOptionsSignal.set(this.fallbackBrandOptions());
        }
        this.brandsLoadedSignal.set(true);
      },
    });
  }

  /** Suggestions for one field only (all values on focus, filtered while typing). */
  suggest(field: ProductSuggestField, term: string): string[] {
    const values = this.indexSignal()[field];
    return this.filterValues(values, term);
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
    return this.filterValues(values, term);
  }

  suggestBrandOptions(term: string): CatalogBrandOption[] {
    const options = this.brandOptionsSignal();
    const query = term.trim().toLowerCase();

    if (!query) {
      return options;
    }

    return options
      .filter((option) => option.brandName.toLowerCase().includes(query))
      .slice(0, MAX_FILTERED_SUGGESTIONS);
  }

  getBrandLogoUrl(brandName: string): string | null {
    const name = brandName.trim();
    if (!name) {
      return null;
    }
    return this.brandOptionsSignal().find((brand) => brand.brandName === name)?.logoUrl ?? null;
  }

  getBrandInitials(brandName: string): string {
    const value = brandName.trim();
    if (!value) {
      return '?';
    }
    return value.slice(0, 2).toUpperCase();
  }

  private filterValues(values: string[], term: string): string[] {
    const query = term.trim().toLowerCase();

    if (!query) {
      return values;
    }

    return values
      .filter((value) => value.toLowerCase().includes(query))
      .slice(0, MAX_FILTERED_SUGGESTIONS);
  }

  private fallbackBrandOptions(): CatalogBrandOption[] {
    return this.indexSignal().brand.map((brandName) => ({
      brandName,
      logoUrl: null,
    }));
  }

  private buildIndex(products: Product[]): {
    index: FieldIndex;
    brandDesignations: ReadonlyMap<string, string[]>;
  } {
    const sets: Record<ProductSuggestField, Set<string>> = {
      brand: new Set(),
      designation: new Set(),
      description: new Set(),
      specifications: new Set(),
    };
    const brandDesignationSets = new Map<string, Set<string>>();

    for (const product of products) {
      this.add(sets.brand, product.brand);
      this.add(sets.designation, product.designation);
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
        description: sort(sets.description),
        specifications: sort(sets.specifications),
      },
      brandDesignations,
    };
  }

  private resolveBrandLogoPreviews(): void {
    this.clearBrandLogoObjectUrls();

    this.brandOptionsSignal().forEach((brand) => {
      if (!brand.logoUrl || brand.logoUrl.startsWith('blob:')) {
        return;
      }

      this.consumerCatalog.fetchBrandLogoBlob(brand.logoUrl).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.brandLogoObjectUrls.add(objectUrl);
          this.brandOptionsSignal.update((items) =>
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

  private add(set: Set<string>, value: string | undefined): void {
    const trimmed = value?.trim();
    if (trimmed) {
      set.add(trimmed);
    }
  }
}
