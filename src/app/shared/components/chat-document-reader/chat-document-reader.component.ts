import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  documentTypeLabel,
  DocumentViewerKind,
  documentPreviewSizeMessage,
  isDocumentTooLargeForPreview,
  resolveDocumentViewerKind,
} from '../../utils/document-viewer.util';

@Component({
  selector: 'app-chat-document-reader',
  templateUrl: './chat-document-reader.component.html',
  styleUrl: './chat-document-reader.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class ChatDocumentReaderComponent {
  readonly blob = input.required<Blob>();
  readonly fileName = input.required<string>();
  readonly contentType = input.required<string>();
  readonly downloadUrl = input<string | null>(null);

  readonly closed = output<void>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly bodyRef = viewChild<ElementRef<HTMLElement>>('readerBody');
  private readonly createdUrls: string[] = [];

  readonly rendering = signal(true);
  readonly renderError = signal<string | null>(null);
  readonly documentKind = signal<DocumentViewerKind>('unsupported');

  constructor() {
    afterNextRender(() => {
      void this.renderDocument();
    });

    this.destroyRef.onDestroy(() => {
      for (const url of this.createdUrls) {
        URL.revokeObjectURL(url);
      }
    });
  }

  typeLabel(): string {
    return documentTypeLabel(this.documentKind());
  }

  close(): void {
    this.closed.emit();
  }

  download(): void {
    const url = this.downloadUrl();
    if (!url) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.fileName();
    anchor.click();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  private async renderDocument(): Promise<void> {
    const container = this.bodyRef()?.nativeElement;
    if (!container) {
      this.rendering.set(false);
      this.renderError.set('Could not open document viewer.');
      return;
    }

    const blob = this.blob();
    if (!blob.size) {
      this.rendering.set(false);
      this.renderError.set('This file appears to be empty.');
      return;
    }

    if (isDocumentTooLargeForPreview(blob.size)) {
      this.rendering.set(false);
      this.renderError.set(documentPreviewSizeMessage());
      return;
    }

    const kind = resolveDocumentViewerKind(this.fileName(), this.contentType());
    this.documentKind.set(kind);

    if (kind === 'unsupported') {
      this.rendering.set(false);
      this.renderError.set('Preview is not available for this file type. Download to open it.');
      return;
    }

    try {
      switch (kind) {
        case 'pdf':
          this.renderPdf(blob, container);
          break;
        case 'docx':
          await this.renderDocx(blob, container);
          break;
        case 'excel':
          await this.renderExcel(blob, container);
          break;
        case 'pptx':
          await this.renderPptx(blob, container);
          break;
        case 'text':
          await this.renderText(blob, container);
          break;
      }
    } catch (error) {
      console.error('Document preview failed', error);
      this.renderError.set('Could not render this document. Try downloading it instead.');
    } finally {
      this.rendering.set(false);
    }
  }

  private resolvePreviewUrl(blob: Blob): string {
    const existing = this.downloadUrl();
    if (existing) {
      return existing;
    }
    const url = URL.createObjectURL(blob);
    this.createdUrls.push(url);
    return url;
  }

  private renderPdf(blob: Blob, container: HTMLElement): void {
    const url = this.resolvePreviewUrl(blob);
    const frame = document.createElement('iframe');
    frame.className = 'pdf-native-viewer';
    frame.src = url;
    frame.title = this.fileName();
    container.appendChild(frame);
  }

  private async renderDocx(blob: Blob, container: HTMLElement): Promise<void> {
    const { renderAsync } = await import('docx-preview');
    const wrapper = document.createElement('div');
    wrapper.className = 'docx-reader';
    container.appendChild(wrapper);

    const styleContainer = document.createElement('div');
    styleContainer.className = 'docx-styles';
    wrapper.appendChild(styleContainer);

    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'docx-body';
    wrapper.appendChild(bodyContainer);

    await renderAsync(await blob.arrayBuffer(), bodyContainer, styleContainer, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
    });
  }

  private async renderExcel(blob: Blob, container: HTMLElement): Promise<void> {
    const module = await import('xlsx');
    const XLSX = module.default ?? module;
    const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });

    if (!workbook.SheetNames.length) {
      throw new Error('Workbook has no sheets');
    }

    const sheetsHost = document.createElement('div');
    sheetsHost.className = 'excel-sheets';
    container.appendChild(sheetsHost);

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const section = document.createElement('section');
      section.className = 'excel-sheet';

      const title = document.createElement('h3');
      title.className = 'excel-sheet-title';
      title.textContent = sheetName;
      section.appendChild(title);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'excel-table-wrap';
      tableWrap.innerHTML = XLSX.utils.sheet_to_html(sheet);
      section.appendChild(tableWrap);
      sheetsHost.appendChild(section);
    }
  }

  private async renderPptx(blob: Blob, container: HTMLElement): Promise<void> {
    const module = await import('pptx-preview');
    const init = module.init ?? module.default?.init;
    if (typeof init !== 'function') {
      throw new Error('PPTX preview library unavailable');
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'pptx-reader';
    container.appendChild(wrapper);

    const width = Math.min(window.innerWidth - 48, 960);
    const previewer = init(wrapper, {
      width,
      height: Math.round(width * 0.5625),
      mode: 'list',
    });

    await previewer.preview(await blob.arrayBuffer());
  }

  private async renderText(blob: Blob, container: HTMLElement): Promise<void> {
    const pre = document.createElement('pre');
    pre.className = 'text-document';
    pre.textContent = await blob.text();
    container.appendChild(pre);
  }
}
