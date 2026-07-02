import {
  Component,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  CatalogBrandOption,
  ProductCatalogLookupService,
  ProductSuggestField,
} from '../../../core/services/product/product-catalog-lookup.service';

@Component({
  selector: 'app-product-field-autocomplete',
  imports: [],
  templateUrl: './product-field-autocomplete.component.html',
  styleUrl: './product-field-autocomplete.component.css',
})
export class ProductFieldAutocompleteComponent implements OnInit {
  private readonly catalog = inject(ProductCatalogLookupService);

  readonly field = input.required<ProductSuggestField>();
  readonly value = input.required<string>();
  readonly placeholder = input('');
  readonly ariaLabel = input<string | undefined>(undefined);
  /** When set on designation fields, limits suggestions to this brand in the catalog. */
  readonly brandFilter = input<string | undefined>(undefined);
  /** Show brand logos in the dropdown (consumer quotation form). */
  readonly richBrands = input(false);

  readonly valueChange = output<string>();

  private readonly focused = signal(false);

  protected readonly dropdownOpen = signal(false);
  protected readonly suggestions = signal<string[]>([]);
  protected readonly brandOptions = signal<CatalogBrandOption[]>([]);

  constructor() {
    effect(() => {
      if (!this.focused()) {
        return;
      }

      this.brandFilter();
      this.richBrands();

      if (this.field() === 'brand' && this.richBrands()) {
        if (this.catalog.brandsLoaded()) {
          this.refreshBrandOptions(this.value());
        }
        return;
      }

      if (this.catalog.loaded()) {
        this.refreshSuggestions(this.value());
      }
    });

    effect(() => {
      if (this.field() === 'brand' && this.richBrands() && this.catalog.brandsLoaded() && this.focused()) {
        this.refreshBrandOptions(this.value());
      }
    });

    effect(() => {
      if (this.field() !== 'brand' && this.catalog.loaded() && this.focused()) {
        this.refreshSuggestions(this.value());
      }
    });
  }

  ngOnInit(): void {
    this.catalog.ensureLoaded();
    if (this.field() === 'brand' && this.richBrands()) {
      this.catalog.ensureConsumerBrandsLoaded();
    }
  }

  onFocus(): void {
    this.focused.set(true);
    this.catalog.ensureLoaded();
    if (this.field() === 'brand' && this.richBrands()) {
      this.catalog.ensureConsumerBrandsLoaded();
      this.refreshBrandOptions(this.value());
      this.dropdownOpen.set(this.brandOptions().length > 0 || this.catalog.loading());
      return;
    }

    this.refreshSuggestions(this.value());
    this.dropdownOpen.set(this.suggestions().length > 0 || this.catalog.loading());
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.valueChange.emit(raw);
    if (this.field() === 'brand' && this.richBrands()) {
      this.refreshBrandOptions(raw);
      this.dropdownOpen.set(this.brandOptions().length > 0 || this.catalog.loading());
      return;
    }

    this.refreshSuggestions(raw);
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
    this.dropdownOpen.set(false);
    this.suggestions.set([]);
    this.brandOptions.set([]);
  }

  selectBrandOption(option: CatalogBrandOption, event: MouseEvent): void {
    this.selectSuggestion(option.brandName, event);
  }

  brandInitials(brandName: string): string {
    return this.catalog.getBrandInitials(brandName);
  }

  isLoading(): boolean {
    if (this.field() === 'brand' && this.richBrands()) {
      return !this.catalog.brandsLoaded();
    }
    return this.catalog.loading() && !this.catalog.loaded();
  }

  showBrandDropdown(): boolean {
    return this.field() === 'brand' && this.richBrands();
  }

  hasDropdownItems(): boolean {
    return this.showBrandDropdown()
      ? this.brandOptions().length > 0
      : this.suggestions().length > 0;
  }

  private refreshSuggestions(term: string): void {
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
