import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { InquiryCartService } from '../../../core/services/inquiry/inquiry-cart.service';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { ProductService } from '../../../core/services/product/product.service';
import { ProductQueryFormService } from '../../../core/services/product/product-query-form.service';
import { Inquiry } from '../../../core/models/inquiry.model';
import { ProductFormDraft, ProductFormRow } from '../../../core/models/product-form.model';
import { forkJoin, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-product-request-panel',
  imports: [FormsModule],
  templateUrl: './product-request-panel.component.html',
  styleUrl: './product-request-panel.component.css',
})
export class ProductRequestPanelComponent {
  private readonly cart = inject(InquiryCartService);
  private readonly inquiryService = inject(InquiryService);
  private readonly auth = inject(AuthService);
  private readonly productService = inject(ProductService);
  readonly formState = inject(ProductQueryFormService);

  readonly submitted = output<Inquiry>();

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly lastSubmitted = signal<Inquiry | null>(null);
  readonly previewOpen = signal(false);

  readonly rows = this.formState.rows;
  readonly highlight = this.formState.highlight;

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
    this.previewOpen.set(true);
  }

  closePreview(): void {
    this.previewOpen.set(false);
  }

  clearForm(): void {
    this.formState.resetRows();
    this.submitError.set(null);
    this.lastSubmitted.set(null);
    this.previewOpen.set(false);
  }

  submitAnother(): void {
    this.lastSubmitted.set(null);
    this.formState.resetRows();
    this.submitError.set(null);
    this.previewOpen.set(false);
  }

  validRows(): ProductFormRow[] {
    return this.rows().filter((r) => r.brand.trim() && r.designation.trim());
  }

  totalPreviewQty(): number {
    return this.validRows().reduce((sum, row) => sum + row.quantity, 0);
  }

  submitRequest(): void {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'CONSUMER') {
      this.submitError.set('Only consumer accounts can create quotations.');
      return;
    }

    const valid = this.validRows();
    if (valid.length === 0) {
      this.submitError.set('Add at least one product with brand and designation.');
      return;
    }

    const incomplete = this.rows().filter(
      (r) => !this.formState.isEmptyRow(r) && (!r.brand.trim() || !r.designation.trim()),
    );
    if (incomplete.length > 0) {
      this.submitError.set('Each row must have both brand and designation, or be cleared.');
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

          return this.inquiryService.create(
            {
              title,
              description,
              searchTerm: this.cart.searchTerm().trim() || undefined,
              items: resolved.map(({ row, productId }) => ({
                productId,
                quantity: row.quantity,
                notes: row.lineNotes.trim() || undefined,
                lineSource: row.lineSource,
              })),
            },
            user.companyId,
          );
        }),
      )
      .subscribe({
        next: (inquiry) => {
          this.submitting.set(false);
          this.cart.clear();
          this.formState.resetRows();
          this.previewOpen.set(false);
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
