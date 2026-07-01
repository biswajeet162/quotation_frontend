import { Injectable, signal } from '@angular/core';
import { formatSpecificationsInline } from '../../../shared/utils/specifications-display.util';
import { Product } from '../../models/product.model';
import {
  createProductFormRow,
  emptyProductFormDraft,
  ProductFormDraft,
  ProductFormRow,
  RowLocalAttachment,
} from '../../models/product-form.model';
import { CatalogProduct } from '../../models/catalog-product.model';
import { InquiryLineSource } from '../../models/inquiry.model';
import { TimelineAttachmentMediaType } from '../../models/inquiry-timeline.model';
import { resolveAttachmentMediaType } from '../../../shared/utils/attachment-media-type.util';

@Injectable({ providedIn: 'root' })
export class ProductQueryFormService {
  private readonly rowsSignal = signal<ProductFormRow[]>([createProductFormRow()]);
  private readonly highlightSignal = signal(false);

  readonly rows = this.rowsSignal.asReadonly();
  readonly highlight = this.highlightSignal.asReadonly();

  resetRows(): void {
    this.revokeAllLocalAttachments(this.rowsSignal());
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
      const removed = rows.find((r) => r.rowId === rowId);
      if (removed) {
        this.revokeLocalAttachments(removed.localAttachments);
      }
      const next = rows.filter((r) => r.rowId !== rowId);
      return next.length > 0 ? next : [createProductFormRow()];
    });
  }

  rowAttachmentCount(row: ProductFormRow): number {
    return (row.attachmentCount ?? 0) + row.localAttachments.length;
  }

  addLocalFiles(rowId: string, files: File[]): void {
    const added: RowLocalAttachment[] = [];
    for (const file of files) {
      const mediaType = resolveAttachmentMediaType(file);
      if (!mediaType) {
        continue;
      }
      added.push({
        localId: `local-${crypto.randomUUID?.() ?? Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        fileName: file.name,
        mediaType,
        contentType: file.type || 'application/octet-stream',
        file,
        blobUrl: URL.createObjectURL(file),
      });
    }
    if (added.length === 0) {
      return;
    }
    this.rowsSignal.update((rows) =>
      rows.map((row) =>
        row.rowId === rowId
          ? { ...row, localAttachments: [...row.localAttachments, ...added] }
          : row,
      ),
    );
  }

  removeLocalAttachment(rowId: string, localId: string): void {
    this.rowsSignal.update((rows) =>
      rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }
        const target = row.localAttachments.find((item) => item.localId === localId);
        if (target) {
          URL.revokeObjectURL(target.blobUrl);
        }
        return {
          ...row,
          localAttachments: row.localAttachments.filter((item) => item.localId !== localId),
        };
      }),
    );
  }

  collectLocalFiles(rows: ProductFormRow[]): File[] {
    return rows.flatMap((row) => row.localAttachments.map((item) => item.file));
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

  fillFromCatalogProduct(
    entry: CatalogProduct,
    lineSource: InquiryLineSource = 'CATALOG_MATCH',
  ): void {
    this.upsertPrefillRow({
      catalogProductId: entry.productId,
      brand: entry.brand ?? '',
      designation: entry.designation ?? '',
      description: entry.description ?? '',
      attachmentCount: entry.attachmentCount ?? 0,
      quantity: 1,
      lineNotes: '',
      lineSource,
    });
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
      !row.specifications.trim() &&
      !row.aliasNames.trim() &&
      !row.lineNotes.trim() &&
      !row.catalogProductId &&
      row.localAttachments.length === 0 &&
      row.quantity <= 1
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
      specifications: formatSpecificationsInline(product.specifications),
      aliasNames: product.aliasNames ?? '',
      quantity: 1,
      lineNotes: '',
      lineSource,
    };
  }

  private revokeLocalAttachments(attachments: RowLocalAttachment[]): void {
    for (const attachment of attachments) {
      URL.revokeObjectURL(attachment.blobUrl);
    }
  }

  private revokeAllLocalAttachments(rows: ProductFormRow[]): void {
    for (const row of rows) {
      this.revokeLocalAttachments(row.localAttachments);
    }
  }
}
