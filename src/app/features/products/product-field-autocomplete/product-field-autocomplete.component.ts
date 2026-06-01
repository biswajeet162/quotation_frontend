import { NgStyle } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ProductCatalogLookupService,
  ProductSuggestField,
} from '../../../core/services/product/product-catalog-lookup.service';

@Component({
  selector: 'app-product-field-autocomplete',
  imports: [NgStyle],
  templateUrl: './product-field-autocomplete.component.html',
  styleUrl: './product-field-autocomplete.component.css',
})
export class ProductFieldAutocompleteComponent implements OnInit {
  private readonly catalog = inject(ProductCatalogLookupService);

  readonly field = input.required<ProductSuggestField>();
  readonly value = input.required<string>();
  readonly placeholder = input('');
  readonly ariaLabel = input<string | undefined>(undefined);

  readonly valueChange = output<string>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  private readonly focused = signal(false);

  protected readonly dropdownOpen = signal(false);
  protected readonly suggestions = signal<string[]>([]);
  protected readonly dropdownStyle = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      if (this.catalog.loaded() && this.focused()) {
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
    const hasSuggestions = this.suggestions().length > 0;
    this.dropdownOpen.set(hasSuggestions);
    if (hasSuggestions) {
      this.positionDropdown();
    }
  }

  private refreshSuggestions(term: string): void {
    this.suggestions.set(this.catalog.suggest(this.field(), term));
  }

  private positionDropdown(): void {
    const el = this.inputRef()?.nativeElement;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    this.dropdownStyle.set({
      top: `${rect.bottom + 2}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    });
  }
}
