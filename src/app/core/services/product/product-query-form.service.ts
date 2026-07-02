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
  private readonly draftSessionIdSignal = signal(this.createDraftSessionId());

  readonly rows = this.rowsSignal.asReadonly();
  readonly highlight = this.highlightSignal.asReadonly();
  readonly draftSessionId = this.draftSessionIdSignal.asReadonly();

  resetRows(): void {
    this.revokeAllLocalAttachments(this.rowsSignal());
    this.rowsSignal.set([createProductFormRow()]);
    this.highlightSignal.set(false);
    this.draftSessionIdSignal.set(this.createDraftSessionId());
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
    return row.localAttachments.length;
  }

  addLocalFiles(rowId: string, files: File[]): RowLocalAttachment[] {
    const added: RowLocalAttachment[] = [];
    for (const file of files) {
      const mediaType = resolveAttachmentMediaType(file);
      if (mediaType !== 'IMAGE') {
        continue;
      }
      added.push({
        localId: `local-${crypto.randomUUID?.() ?? Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        fileName: file.name,
        mediaType,
        contentType: file.type || 'image/jpeg',
        file,
        blobUrl: URL.createObjectURL(file),
        uploadStatus: 'uploading',
      });
    }
    if (added.length === 0) {
      return [];
    }
    this.rowsSignal.update((rows) =>
      rows.map((row) =>
        row.rowId === rowId
          ? { ...row, localAttachments: [...row.localAttachments, ...added] }
          : row,
      ),
    );
    return added;
  }

  updateLocalAttachment(
    rowId: string,
    localId: string,
    patch: Partial<RowLocalAttachment>,
  ): void {
    this.rowsSignal.update((rows) =>
      rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }
        return {
          ...row,
          localAttachments: row.localAttachments.map((attachment) =>
            attachment.localId === localId ? { ...attachment, ...patch } : attachment,
          ),
        };
      }),
    );
  }

  attachmentIdsForRow(row: ProductFormRow): string[] {
    return row.localAttachments
      .map((attachment) => attachment.serverAttachmentId)
      .filter((id): id is string => Boolean(id));
  }

  hasUploadingAttachments(rows: ProductFormRow[] = this.rowsSignal()): boolean {
    return rows.some((row) =>
      row.localAttachments.some((attachment) => attachment.uploadStatus === 'uploading'),
    );
  }

  hasAttachmentErrors(rows: ProductFormRow[] = this.rowsSignal()): boolean {
    return rows.some((row) =>
      row.localAttachments.some((attachment) => attachment.uploadStatus === 'error'),
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
    description?: string;
    specifications?: string;
  } {
    return {
      brand: row.brand.trim(),
      designation: row.designation.trim(),
      description: row.description.trim() || undefined,
      specifications: row.specifications.trim() || undefined,
    };
  }

  isEmptyRow(row: ProductFormRow): boolean {
    return (
      !row.brand.trim() &&
      !row.designation.trim() &&
      !row.description.trim() &&
      !row.specifications.trim() &&
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
      description: product.description ?? '',
      specifications: formatSpecificationsInline(product.specifications),
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

  private createDraftSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `draft-${crypto.randomUUID()}`;
    }
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
