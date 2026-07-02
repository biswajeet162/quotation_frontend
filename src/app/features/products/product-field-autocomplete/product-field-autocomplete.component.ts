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

  readonly valueChange = output<string>();

  private readonly focused = signal(false);

  protected readonly dropdownOpen = signal(false);
  protected readonly suggestions = signal<string[]>([]);

  constructor() {
    effect(() => {
      if (this.catalog.loaded() && this.focused()) {
        this.brandFilter();
        this.showSuggestionsFor(this.value());
      }
    });
  }

  ngOnInit(): void {
    this.catalog.ensureLoaded();
  }

  onFocus(): void {
    this.focused.set(true);
    this.catalog.ensureLoaded();
    this.showSuggestionsFor(this.value());
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.valueChange.emit(raw);
    this.showSuggestionsFor(raw);
  }

  onBlur(): void {
    this.focused.set(false);
    window.setTimeout(() => this.dropdownOpen.set(false), 180);
  }

  selectSuggestion(option: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.valueChange.emit(option);
    this.dropdownOpen.set(false);
    this.suggestions.set([]);
  }

  private showSuggestionsFor(term: string): void {
    this.refreshSuggestions(term);
    this.dropdownOpen.set(this.suggestions().length > 0);
  }

  private refreshSuggestions(term: string): void {
    if (this.field() === 'designation') {
      this.suggestions.set(this.catalog.suggestDesignation(term, this.brandFilter()));
      return;
    }
    this.suggestions.set(this.catalog.suggest(this.field(), term));
  }
}
