import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicImage, PublicImageSet } from '../../../core/models/public-image.model';
import { PublicImageService } from '../../../core/services/public-image/public-image.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type ViewMode = 'gallery' | 'slider';

@Component({
  selector: 'app-public-image-viewer',
  imports: [LoadingOverlayComponent],
  templateUrl: './public-image-viewer.component.html',
  styleUrl: './public-image-viewer.component.css',
})
export class PublicImageViewerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly publicImageService = inject(PublicImageService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly imageSet = signal<PublicImageSet | null>(null);
  readonly requestedImageId = signal<string | null>(null);
  readonly viewMode = signal<ViewMode>('gallery');
  readonly sliderIndex = signal(0);

  readonly images = computed(() => this.imageSet()?.images ?? []);
  readonly imageCount = computed(() => this.images().length);
  readonly quotationNumber = computed(() => this.imageSet()?.quotationNumber?.trim() || null);
  readonly currentSlide = computed(() => this.images()[this.sliderIndex()] ?? null);
  readonly canGoPrev = computed(() => this.sliderIndex() > 0);
  readonly canGoNext = computed(() => this.sliderIndex() < this.imageCount() - 1);

  ngOnInit(): void {
    const imageId = this.route.snapshot.paramMap.get('imageId');
    if (!imageId) {
      this.loading.set(false);
      this.errorMessage.set('Invalid image link. No image id provided.');
      return;
    }

    this.requestedImageId.set(imageId);
    this.publicImageService.getImageSet(imageId).subscribe({
      next: (set) => {
        this.imageSet.set(set);
        const requestedIndex = set.images.findIndex((image) => image.id === imageId);
        this.sliderIndex.set(requestedIndex >= 0 ? requestedIndex : 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error?.message;
        this.errorMessage.set(
          typeof message === 'string' ? message : 'Image not found or no longer available.',
        );
      },
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  openInSlider(index: number): void {
    this.sliderIndex.set(index);
    this.viewMode.set('slider');
  }

  backToGallery(): void {
    this.viewMode.set('gallery');
  }

  goPrev(): void {
    if (!this.canGoPrev()) {
      return;
    }
    this.sliderIndex.update((index) => index - 1);
  }

  goNext(): void {
    if (!this.canGoNext()) {
      return;
    }
    this.sliderIndex.update((index) => index + 1);
  }

  goToSlide(index: number): void {
    if (index < 0 || index >= this.imageCount()) {
      return;
    }
    this.sliderIndex.set(index);
  }

  imageSrc(image: PublicImage): string {
    return this.publicImageService.contentAbsoluteUrl(image.contentUrl);
  }

  imageLabel(image: PublicImage, index: number): string {
    const serial = String(index + 1);
    const product = this.productLabel(image);
    return product ? `${serial}. ${product}` : `${serial}. ${image.fileName || 'Image'}`;
  }

  productLabel(image: PublicImage): string {
    const brand = image.brand?.trim() ?? '';
    const designation = image.designation?.trim() ?? '';
    if (brand && designation) {
      return `${brand} · ${designation}`;
    }
    return brand || designation || '';
  }

  isRequested(image: PublicImage): boolean {
    return image.id === this.requestedImageId();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.viewMode() !== 'slider' || this.loading()) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goNext();
    }
  }
}
