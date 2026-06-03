import { Component, HostListener, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { InquiryCartService } from '../../../core/services/inquiry/inquiry-cart.service';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { ProductService } from '../../../core/services/product/product.service';
import { ProductCatalogLookupService } from '../../../core/services/product/product-catalog-lookup.service';
import { ProductQueryFormService } from '../../../core/services/product/product-query-form.service';
import { ConsumerInquiryCreated } from '../../../core/models/inquiry.model';
import { ProductFormDraft, ProductFormRow } from '../../../core/models/product-form.model';
import { formatSpecificationsInline } from '../../../shared/utils/specifications-display.util';
import { ProductFieldAutocompleteComponent } from '../product-field-autocomplete/product-field-autocomplete.component';
import { forkJoin, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-product-request-panel',
  imports: [FormsModule, ProductFieldAutocompleteComponent],
  templateUrl: './product-request-panel.component.html',
  styleUrl: './product-request-panel.component.css',
})
export class ProductRequestPanelComponent implements OnInit {
  private readonly cart = inject(InquiryCartService);
  private readonly inquiryService = inject(InquiryService);
  private readonly auth = inject(AuthService);
  private readonly productService = inject(ProductService);
  private readonly catalog = inject(ProductCatalogLookupService);
  readonly formState = inject(ProductQueryFormService);

  readonly submitted = output<ConsumerInquiryCreated>();

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly lastSubmitted = signal<ConsumerInquiryCreated | null>(null);
  readonly previewOpen = signal(false);

  readonly rows = this.formState.rows;
  readonly highlight = this.formState.highlight;

  ngOnInit(): void {
    this.catalog.ensureLoaded();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.previewOpen()) {
      this.closePreview();
    }
  }

  addRow(): void {
    this.formState.addRow();
  }

  removeRow(rowId: string): void {
    this.formState.removeRow(rowId);
  }

  updateRowField<K extends keyof ProductFormDraft>(
    rowId: string,
    field: K,
    value: ProductFormDraft[K],
  ): void {
    this.formState.updateRow(rowId, { [field]: value });
  }

  updateRowQuantity(rowId: string, value: string): void {
    this.updateRowField(rowId, 'quantity', Math.max(1, Number(value) || 1));
  }

  openPreview(): void {
    this.submitError.set(null);
    this.previewOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closePreview(): void {
    this.previewOpen.set(false);
    document.body.style.overflow = '';
  }

  clearForm(): void {
    this.formState.resetRows();
    this.submitError.set(null);
    this.lastSubmitted.set(null);
    this.closePreview();
  }

  submitAnother(): void {
    this.lastSubmitted.set(null);
    this.formState.resetRows();
    this.submitError.set(null);
    this.closePreview();
  }

  /** Rows with at least one field filled — fully empty rows are excluded from preview. */
  previewRows(): ProductFormRow[] {
    return this.rows().filter((r) => !this.formState.isEmptyRow(r));
  }

  totalPreviewQty(): number {
    return this.previewRows().reduce((sum, row) => sum + row.quantity, 0);
  }

  formatSpecs(value: string | undefined): string {
    const formatted = formatSpecificationsInline(value);
    return formatted || '—';
  }

  submitRequest(): void {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'CONSUMER') {
      this.submitError.set('Only consumer accounts can create quotations.');
      return;
    }

    const valid = this.previewRows();
    if (valid.length === 0) {
      this.submitError.set('Add at least one product row with some details.');
      return;
    }

    const notSubmittable = valid.filter(
      (r) => !r.catalogProductId && (!r.brand.trim() || !r.designation.trim()),
    );
    if (notSubmittable.length > 0) {
      this.submitError.set(
        'Each product row needs brand and designation, or must be added from the catalog.',
      );
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const productRequests = valid.map((row) =>
      row.catalogProductId
        ? of({ row, productId: row.catalogProductId })
        : this.productService
            .findOrCreate(this.formState.toFindOrCreateRequest(row))
            .pipe(map((product) => ({ row, productId: product.id }))),
    );

    forkJoin(productRequests)
      .pipe(
        switchMap((resolved) => {
          const title =
            resolved.length === 1
              ? `${resolved[0].row.brand.trim()} ${resolved[0].row.designation.trim()}`
              : `Quotation request (${resolved.length} products)`;

          const description =
            resolved.length === 1 ? resolved[0].row.description.trim() || undefined : undefined;

          // Single POST /inquiries: one inquiryId, all rows as items[] on the same query.
          return this.inquiryService.create({
            title,
            description,
            searchTerm: this.cart.searchTerm().trim() || undefined,
            items: resolved.map(({ row, productId }) => ({
              productId,
              quantity: row.quantity,
              notes: row.lineNotes.trim() || undefined,
              lineSource: row.lineSource,
            })),
          });
        }),
      )
      .subscribe({
        next: (inquiry) => {
          this.submitting.set(false);
          this.cart.clear();
          this.formState.resetRows();
          this.closePreview();
          this.lastSubmitted.set(inquiry);
          this.submitted.emit(inquiry);
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Could not submit your quotation request. Please try again.');
        },
      });
  }
}
