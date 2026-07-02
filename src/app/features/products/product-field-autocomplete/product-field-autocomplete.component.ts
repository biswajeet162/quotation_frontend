import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Observable } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { CatalogBrand, CatalogProduct } from '../../../core/models/catalog-product.model';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product/product.service';
import { ConsumerProductCatalogService } from '../../../core/services/product/consumer-product-catalog.service';
import {
  CatalogBrandOption,
  ProductCatalogLookupService,
  ProductSuggestField,
} from '../../../core/services/product/product-catalog-lookup.service';

interface RemoteSearchRequest {
  field: ProductSuggestField;
  term: string;
  brand?: string;
}

@Component({
  selector: 'app-product-field-autocomplete',
  imports: [],
  templateUrl: './product-field-autocomplete.component.html',
  styleUrl: './product-field-autocomplete.component.css',
})
export class ProductFieldAutocompleteComponent implements OnInit {
  private readonly catalog = inject(ProductCatalogLookupService);
  private readonly productService = inject(ProductService);
  private readonly consumerCatalog = inject(ConsumerProductCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  readonly field = input.required<ProductSuggestField>();
  readonly value = input.required<string>();
  readonly placeholder = input('');
  readonly ariaLabel = input<string | undefined>(undefined);
  /** When set, limits remote/local designation suggestions to this brand. */
  readonly brandFilter = input<string | undefined>(undefined);
  /** Show brand logos in the dropdown (consumer quotation form). */
  readonly richBrands = input(false);
  /** Query the backend with debounced switchMap search (cancels in-flight HTTP calls). */
  readonly remoteSearch = input(false);

  readonly valueChange = output<string>();
  /** Emitted when the user picks a value from the suggestion list (not plain typing). */
  readonly suggestionSelected = output<string>();
  readonly catalogProductSelect = output<CatalogProduct>();

  private readonly focused = signal(false);
  private readonly searchRequests$ = new Subject<RemoteSearchRequest>();
  private readonly brandLogoObjectUrls = new Set<string>();

  protected readonly dropdownOpen = signal(false);
  protected readonly suggestions = signal<string[]>([]);
  protected readonly productSuggestions = signal<CatalogProduct[]>([]);
  protected readonly brandOptions = signal<CatalogBrandOption[]>([]);
  protected readonly searching = signal(false);
  protected readonly dropdownStyle = signal<{ top: string; left: string; width: string } | null>(
    null,
  );

  constructor() {
    effect(() => {
      if (!this.focused()) {
        return;
      }

      this.brandFilter();
      this.richBrands();

      if (this.useRemoteSearch()) {
        this.emitRemoteSearch(this.value());
        return;
      }

      if (this.field() === 'brand' && this.richBrands()) {
        if (this.catalog.brandsLoaded()) {
          this.refreshBrandOptions(this.value());
        }
        return;
      }

      if (this.catalog.loaded()) {
        this.refreshLocalSuggestions(this.value());
      }
    });

    effect(() => {
      if (
        this.field() === 'brand' &&
        this.richBrands() &&
        !this.useRemoteSearch() &&
        this.catalog.brandsLoaded() &&
        this.focused()
      ) {
        this.refreshBrandOptions(this.value());
      }
    });

    effect(() => {
      if (
        this.field() !== 'brand' &&
        !this.useRemoteSearch() &&
        this.catalog.loaded() &&
        this.focused()
      ) {
        this.refreshLocalSuggestions(this.value());
      }
    });
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.clearBrandLogoObjectUrls());

    if (this.useRemoteSearch()) {
      this.setupRemoteSearchPipeline();
      return;
    }

    this.catalog.ensureLoaded();
    if (this.field() === 'brand' && this.richBrands()) {
      this.catalog.ensureConsumerBrandsLoaded();
    }
  }

  onFocus(): void {
    this.focused.set(true);
    this.syncDropdownPosition();

    if (this.useRemoteSearch()) {
      this.emitRemoteSearch(this.value());
      this.openRemoteDropdown(this.value());
      return;
    }

    if (this.field() === 'brand' && this.richBrands()) {
      this.catalog.ensureConsumerBrandsLoaded();
      this.refreshBrandOptions(this.value());
      this.dropdownOpen.set(this.brandOptions().length > 0 || this.catalog.loading());
      return;
    }

    this.catalog.ensureLoaded();
    this.refreshLocalSuggestions(this.value());
    this.dropdownOpen.set(this.suggestions().length > 0 || this.catalog.loading());
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.valueChange.emit(raw);

    if (this.useRemoteSearch()) {
      this.emitRemoteSearch(raw);
      this.openRemoteDropdown(raw);
      return;
    }

    if (this.field() === 'brand' && this.richBrands()) {
      this.refreshBrandOptions(raw);
      this.dropdownOpen.set(this.brandOptions().length > 0 || this.catalog.loading());
      return;
    }

    this.refreshLocalSuggestions(raw);
    this.dropdownOpen.set(this.suggestions().length > 0 || this.catalog.loading());
  }

  onBlur(): void {
    this.focused.set(false);
    window.setTimeout(() => this.dropdownOpen.set(false), 180);
  }

  toggleDropdown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.dropdownOpen()) {
      this.dropdownOpen.set(false);
      return;
    }

    this.onFocus();
  }

  selectSuggestion(option: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.valueChange.emit(option);
    this.suggestionSelected.emit(option);
    this.closeDropdown();
  }

  focusInput(): void {
    const input = this.inputEl()?.nativeElement;
    if (!input) {
      return;
    }
    input.focus();
    this.onFocus();
  }

  selectProductSuggestion(product: CatalogProduct, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const field = this.field();
    const selectedValue =
      field === 'brand'
        ? product.brand
        : field === 'designation'
          ? product.designation
          : field === 'description'
            ? (product.description ?? product.designation)
            : product.designation;

    this.valueChange.emit(selectedValue);
    this.catalogProductSelect.emit(product);
    this.closeDropdown();
  }

  selectBrandOption(option: CatalogBrandOption, event: MouseEvent): void {
    this.selectSuggestion(option.brandName, event);
  }

  brandInitials(brandName: string): string {
    return this.catalog.getBrandInitials(brandName);
  }

  isLoading(): boolean {
    if (this.useRemoteSearch()) {
      return this.searching();
    }
    if (this.field() === 'brand' && this.richBrands()) {
      return !this.catalog.brandsLoaded();
    }
    return this.catalog.loading() && !this.catalog.loaded();
  }

  showBrandDropdown(): boolean {
    return (
      this.field() === 'brand' &&
      (this.useRemoteBrandSearch() || (this.richBrands() && !this.useRemoteSearch()))
    );
  }

  showProductDropdown(): boolean {
    return this.useRemoteSearch() && this.field() !== 'brand' && this.field() !== 'designation';
  }

  showDesignationList(): boolean {
    return this.useRemoteSearch() && this.field() === 'designation';
  }

  designationOptions(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const product of this.productSuggestions()) {
      const designation = product.designation?.trim();
      if (!designation || seen.has(designation)) {
        continue;
      }
      seen.add(designation);
      options.push(designation);
    }
    return options;
  }

  hasDropdownItems(): boolean {
    if (this.showBrandDropdown()) {
      return this.brandOptions().length > 0;
    }
    if (this.showDesignationList()) {
      return this.designationOptions().length > 0;
    }
    if (this.showProductDropdown()) {
      return this.productSuggestions().length > 0;
    }
    return this.suggestions().length > 0;
  }

  productSuggestionPrimary(product: CatalogProduct): string {
    const field = this.field();
    if (field === 'brand') {
      return product.brand;
    }
    if (field === 'description') {
      return product.description?.trim() || product.designation;
    }
    return product.designation;
  }

  productSuggestionSecondary(product: CatalogProduct): string | null {
    const field = this.field();
    if (field === 'designation' && !this.brandFilter()) {
      return product.brand;
    }
    if (field === 'description') {
      return `${product.brand} · ${product.designation}`;
    }
    return null;
  }

  private useRemoteSearch(): boolean {
    return this.remoteSearch();
  }

  private useRemoteBrandSearch(): boolean {
    return this.remoteSearch() && this.field() === 'brand';
  }

  protected remoteSearchActive(): boolean {
    return this.useRemoteSearch();
  }

  /**
   * debounceTime → distinctUntilChanged → switchMap
   * switchMap unsubscribes the previous HTTP observable, cancelling in-flight requests.
   */
  private setupRemoteSearchPipeline(): void {
    this.searchRequests$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(
          (previous, current) =>
            previous.field === current.field &&
            previous.term === current.term &&
            previous.brand === current.brand,
        ),
        tap((request) => {
          this.searching.set(request.term.trim().length > 0);
        }),
        switchMap((request) => {
          const trimmed = request.term.trim();
          if (trimmed.length === 0) {
            return of({ field: request.field, brands: [] as CatalogBrandOption[], products: [] as CatalogProduct[] });
          }

          if (request.field === 'brand') {
            return this.consumerCatalog.searchBrands(trimmed, 15).pipe(
              switchMap((brands) => this.resolveBrandOptionsWithBlobUrls(brands)),
              map((brands) => ({
                field: request.field,
                brands,
                products: [] as CatalogProduct[],
              })),
              catchError(() =>
                of({ field: request.field, brands: [] as CatalogBrandOption[], products: [] as CatalogProduct[] }),
              ),
            );
          }

          return this.productService
            .searchCatalog({
              field: request.field,
              term: trimmed,
              brandFilter: request.brand,
              size: 15,
            })
            .pipe(
              map((products) => ({
                field: request.field,
                brands: [] as CatalogBrandOption[],
                products: products.map((product) => this.toCatalogProduct(product)),
              })),
              catchError(() =>
                of({ field: request.field, brands: [] as CatalogBrandOption[], products: [] as CatalogProduct[] }),
              ),
            );
        }),
        tap(() => this.searching.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ field, brands, products }) => {
        if (field === 'brand') {
          this.brandOptions.set(brands);
          this.productSuggestions.set([]);
        } else {
          this.productSuggestions.set(products);
          this.brandOptions.set([]);
        }
        this.openRemoteDropdown(this.value());
        this.syncDropdownPosition();
      });
  }

  selectDesignationOption(designation: string, event: MouseEvent): void {
    this.selectSuggestion(designation, event);
  }

  private openRemoteDropdown(term: string): void {
    if (!this.useRemoteSearch()) {
      return;
    }
    this.dropdownOpen.set(term.trim().length > 0);
  }

  private syncDropdownPosition(): void {
    const input = this.inputEl()?.nativeElement;
    if (!input) {
      this.dropdownStyle.set(null);
      return;
    }

    const rect = input.getBoundingClientRect();
    this.dropdownStyle.set({
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    });
  }

  private emitRemoteSearch(term: string): void {
    if (!this.useRemoteSearch()) {
      return;
    }

    const trimmed = term.trim();
    if (trimmed.length === 0) {
      this.productSuggestions.set([]);
      this.brandOptions.set([]);
      this.searching.set(false);
      return;
    }

    this.searchRequests$.next({
      field: this.field(),
      term,
      brand: this.brandFilter(),
    });
  }

  private toCatalogProduct(product: Product): CatalogProduct {
    return {
      productId: product.id,
      brand: product.brand,
      designation: product.designation,
      description: product.description,
    };
  }

  private closeDropdown(): void {
    this.dropdownOpen.set(false);
    this.dropdownStyle.set(null);
    this.suggestions.set([]);
    this.productSuggestions.set([]);
    this.brandOptions.set([]);
    this.clearBrandLogoObjectUrls();
  }

  private resolveBrandOptionsWithBlobUrls(brands: CatalogBrand[]): Observable<CatalogBrandOption[]> {
    this.clearBrandLogoObjectUrls();

    const options: CatalogBrandOption[] = brands
      .map((brand) => ({
        brandName: brand.brandName?.trim() ?? '',
        logoUrl: brand.logoUrl ?? null,
      }))
      .filter((option) => !!option.brandName);

    if (options.length === 0) {
      return of([]);
    }

    return forkJoin(
      options.map((option) => {
        if (!option.logoUrl || option.logoUrl.startsWith('blob:')) {
          return of(option);
        }

        return this.consumerCatalog.fetchBrandLogoBlob(option.logoUrl).pipe(
          map((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            this.brandLogoObjectUrls.add(objectUrl);
            return { ...option, logoUrl: objectUrl };
          }),
          catchError(() => of({ ...option, logoUrl: null })),
        );
      }),
    );
  }

  private clearBrandLogoObjectUrls(): void {
    this.brandLogoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.brandLogoObjectUrls.clear();
  }

  private refreshLocalSuggestions(term: string): void {
    if (this.field() === 'designation') {
      this.suggestions.set(this.catalog.suggestDesignation(term, this.brandFilter()));
      return;
    }
    this.suggestions.set(this.catalog.suggest(this.field(), term));
  }

  private refreshBrandOptions(term: string): void {
    if (!this.catalog.brandsLoaded()) {
      this.brandOptions.set([]);
      return;
    }
    this.brandOptions.set(this.catalog.suggestBrandOptions(term));
  }
}
