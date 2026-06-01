import { Injectable, signal } from '@angular/core';
import { Product } from '../../models/product.model';
import {
  createProductFormRow,
  emptyProductFormDraft,
  ProductFormDraft,
  ProductFormRow,
} from '../../models/product-form.model';
import { InquiryLineSource } from '../../models/inquiry.model';

@Injectable({ providedIn: 'root' })
export class ProductQueryFormService {
  private readonly rowsSignal = signal<ProductFormRow[]>([createProductFormRow()]);
  private readonly highlightSignal = signal(false);

  readonly rows = this.rowsSignal.asReadonly();
  readonly highlight = this.highlightSignal.asReadonly();

  resetRows(): void {
    this.rowsSignal.set([createProductFormRow()]);
    this.highlightSignal.set(false);
  }

  setHighlight(active: boolean): void {
    this.highlightSignal.set(active);
  }

  addRow(patch?: Partial<ProductFormDraft>): void {
    this.rowsSignal.update((rows) => [...rows, createProductFormRow(patch)]);
  }

  removeRow(rowId: string): void {
    this.rowsSignal.update((rows) => {
      const next = rows.filter((r) => r.rowId !== rowId);
      return next.length > 0 ? next : [createProductFormRow()];
    });
  }

  updateRow(rowId: string, patch: Partial<ProductFormDraft>): void {
    this.rowsSignal.update((rows) =>
      rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    );
  }

  fillFromProduct(product: Product, lineSource: InquiryLineSource = 'CATALOG_MATCH'): void {
    const row = this.productToRowPatch(product, lineSource);
    this.upsertPrefillRow(row);
    this.highlightSignal.set(true);
  }

  fillFromSearchTerm(term: string): void {
    const trimmed = term.trim();
    const parts = trimmed.split(/\s+/);
    const brand = parts[0] ?? '';
    const designation = parts.slice(1).join(' ') || trimmed;

    this.upsertPrefillRow({
      brand,
      designation,
      lineSource: 'NEW_PRODUCT',
    });
    this.highlightSignal.set(true);
  }

  toFindOrCreateRequest(row: ProductFormRow): {
    brand: string;
    designation: string;
    groupName?: string;
    category?: string;
    description?: string;
    specifications?: string;
    aliasNames?: string;
  } {
    return {
      brand: row.brand.trim(),
      designation: row.designation.trim(),
      groupName: row.groupName.trim() || undefined,
      category: row.category.trim() || undefined,
      description: row.description.trim() || undefined,
      specifications: row.specifications.trim() || undefined,
      aliasNames: row.aliasNames.trim() || undefined,
    };
  }

  isEmptyRow(row: ProductFormRow): boolean {
    return (
      !row.brand.trim() &&
      !row.designation.trim() &&
      !row.groupName.trim() &&
      !row.category.trim() &&
      !row.description.trim() &&
      !row.catalogProductId
    );
  }

  private upsertPrefillRow(patch: Partial<ProductFormDraft>): void {
    const rows = this.rowsSignal();
    if (rows.length === 1 && this.isEmptyRow(rows[0])) {
      this.rowsSignal.set([{ ...rows[0], ...emptyProductFormDraft(), ...patch }]);
      return;
    }
    this.addRow(patch);
  }

  private productToRowPatch(
    product: Product,
    lineSource: InquiryLineSource,
  ): Partial<ProductFormDraft> {
    return {
      catalogProductId: product.id,
      brand: product.brand ?? '',
      designation: product.designation ?? '',
      groupName: product.groupName ?? '',
      category: product.category ?? '',
      description: product.description ?? '',
      specifications: product.specifications ?? '',
      aliasNames: product.aliasNames ?? '',
      quantity: 1,
      lineNotes: '',
      lineSource,
    };
  }
}
