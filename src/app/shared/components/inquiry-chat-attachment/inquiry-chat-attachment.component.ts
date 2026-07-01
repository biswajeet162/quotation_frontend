import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InquiryTimelineAttachment } from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { DistributorProductService } from '../../../core/services/distributor/distributor-product.service';
import { ConsumerProductCatalogService } from '../../../core/services/product/consumer-product-catalog.service';
import {
  documentPreviewSizeMessage,
  isDocumentTooLargeForPreview,
} from '../../utils/document-viewer.util';
import { ChatAudioPlayerComponent } from '../chat-audio-player/chat-audio-player.component';
import { ChatDocumentReaderComponent } from '../chat-document-reader/chat-document-reader.component';
import { MediaLightboxComponent } from '../media-lightbox/media-lightbox.component';

@Component({
  selector: 'app-inquiry-chat-attachment',
  imports: [ChatAudioPlayerComponent, ChatDocumentReaderComponent, MediaLightboxComponent],
  templateUrl: './inquiry-chat-attachment.component.html',
  styleUrl: './inquiry-chat-attachment.component.css',
  host: {
    '[class.panel-preview]': 'previewMode() === "panel"',
  },
})
export class InquiryChatAttachmentComponent implements OnInit {
  readonly attachment = input.required<InquiryTimelineAttachment>();
  readonly attachmentSource = input<'inquiry' | 'product' | 'consumer'>('inquiry');
  readonly previewMode = input<'chat' | 'panel'>('chat');

  private readonly inquiryService = inject(InquiryService);
  private readonly productService = inject(DistributorProductService);
  private readonly catalogService = inject(ConsumerProductCatalogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly objectUrl = signal<string | null>(null);
  readonly attachmentBlob = signal<Blob | null>(null);
  readonly viewerOpen = signal(false);
  readonly documentReaderOpen = signal(false);
  readonly documentNotice = signal<string | null>(null);

  readonly documentTooLarge = computed(() => {
    const blob = this.attachmentBlob();
    return blob ? isDocumentTooLargeForPreview(blob.size) : false;
  });

  ngOnInit(): void {
    const fetchBlob = (() => {
      switch (this.attachmentSource()) {
        case 'product':
          return this.productService.fetchAttachmentBlob.bind(this.productService);
        case 'consumer':
          return this.catalogService.fetchAttachmentBlob.bind(this.catalogService);
        default:
          return this.inquiryService.fetchAttachmentBlob.bind(this.inquiryService);
      }
    })();

    fetchBlob(this.attachment().url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const typedBlob = blob.type
            ? blob
            : new Blob([blob], { type: this.attachment().contentType || 'application/octet-stream' });
          this.attachmentBlob.set(typedBlob);
          this.objectUrl.set(URL.createObjectURL(typedBlob));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });

    this.destroyRef.onDestroy(() => {
      const url = this.objectUrl();
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
  }

  attachmentLabel(): string {
    const name = this.attachment().fileName ?? '';
    if (/^voice-/i.test(name)) {
      return 'Voice message';
    }
    return name;
  }

  openViewer(event: Event): void {
    event.stopPropagation();
    this.viewerOpen.set(true);
  }

  openDocumentReader(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.documentNotice.set(null);

    if (this.documentTooLarge()) {
      this.documentNotice.set(documentPreviewSizeMessage());
      return;
    }

    this.documentReaderOpen.set(true);
  }

  downloadDocument(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const url = this.objectUrl();
    if (!url) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.attachment().fileName;
    anchor.click();
  }

  documentActionLabel(): string {
    return this.documentTooLarge() ? 'Download to open' : 'Tap to open';
  }

  closeDocumentReader(): void {
    this.documentReaderOpen.set(false);
  }

  closeViewer(): void {
    this.viewerOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.documentReaderOpen()) {
      this.closeDocumentReader();
      return;
    }
    if (this.viewerOpen()) {
      this.closeViewer();
    }
  }
}
