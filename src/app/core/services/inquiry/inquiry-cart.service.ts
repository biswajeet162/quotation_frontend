import { Injectable, computed, signal } from '@angular/core';
import { QuoteCartLine } from '../../models/inquiry.model';

@Injectable({ providedIn: 'root' })
export class InquiryCartService {
  private readonly linesSignal = signal<QuoteCartLine[]>([]);
  private readonly requestTitleSignal = signal('');
  private readonly requestDescriptionSignal = signal('');
  private readonly searchTermSignal = signal('');

  readonly lines = this.linesSignal.asReadonly();
  readonly requestTitle = this.requestTitleSignal.asReadonly();
  readonly requestDescription = this.requestDescriptionSignal.asReadonly();
  readonly searchTerm = this.searchTermSignal.asReadonly();

  readonly lineCount = computed(() => this.linesSignal().length);
  readonly totalQuantity = computed(() =>
    this.linesSignal().reduce((sum, line) => sum + line.quantity, 0),
  );

  setRequestTitle(title: string): void {
    this.requestTitleSignal.set(title);
  }

  setRequestDescription(description: string): void {
    this.requestDescriptionSignal.set(description);
  }

  setSearchTerm(term: string): void {
    this.searchTermSignal.set(term);
  }

  addLine(line: QuoteCartLine): void {
    const existing = this.linesSignal().find((l) => l.productId === line.productId);
    if (existing) {
      this.linesSignal.update((lines) =>
        lines.map((l) =>
          l.productId === line.productId
            ? {
                ...l,
                quantity: l.quantity + line.quantity,
                lineNotes: line.lineNotes || l.lineNotes,
                lineSource:
                  l.lineSource === 'NEW_PRODUCT' || line.lineSource === 'NEW_PRODUCT'
                    ? 'NEW_PRODUCT'
                    : 'CATALOG_MATCH',
              }
            : l,
        ),
      );
      return;
    }
    this.linesSignal.update((lines) => [...lines, line]);
  }

  updateLineQuantity(productId: string, quantity: number): void {
    if (quantity < 1) {
      this.removeLine(productId);
      return;
    }
    this.linesSignal.update((lines) =>
      lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    );
  }

  updateLineNotes(productId: string, lineNotes: string): void {
    this.linesSignal.update((lines) =>
      lines.map((l) => (l.productId === productId ? { ...l, lineNotes } : l)),
    );
  }

  removeLine(productId: string): void {
    this.linesSignal.update((lines) => lines.filter((l) => l.productId !== productId));
  }

  clear(): void {
    this.linesSignal.set([]);
    this.requestTitleSignal.set('');
    this.requestDescriptionSignal.set('');
    this.searchTermSignal.set('');
  }

  clearLines(): void {
    this.linesSignal.set([]);
  }
}
