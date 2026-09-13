import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { APS_LOGO_DATA_URL } from '../../../shared/branding/aps-logo';
import {
  CATALOG_GROUPS,
  CATALOG_IMAGES,
  CatalogImage,
  HERO_FLOAT_IMAGES,
} from '../data/catalog-images';
import {
  ABOUT_POINTS,
  CAPABILITIES,
  COMPANY,
  PARTNER_BRANDS,
  PRODUCT_CATEGORIES,
} from '../data/company-site.content';

@Component({
  selector: 'app-company-home',
  imports: [RouterLink],
  templateUrl: './company-home.component.html',
  styleUrl: './company-home.component.css',
  host: {
    '(scroll)': 'onHostScroll()',
  },
})
export class CompanyHomeComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly logoSrc = APS_LOGO_DATA_URL;
  readonly company = COMPANY;
  readonly aboutPoints = ABOUT_POINTS;
  readonly categories = PRODUCT_CATEGORIES;
  readonly brands = PARTNER_BRANDS;
  readonly capabilities = CAPABILITIES;
  readonly brandRow = [...PARTNER_BRANDS, ...PARTNER_BRANDS];

  readonly catalogGroups = CATALOG_GROUPS;
  readonly heroFloats = HERO_FLOAT_IMAGES;
  readonly catalogRibbon = [...CATALOG_IMAGES, ...CATALOG_IMAGES];

  readonly menuOpen = signal(false);
  readonly scrolled = signal(false);
  readonly revealReady = signal(false);
  readonly activeGroup = signal<string>('all');

  readonly visibleCatalog = computed(() => {
    const key = this.activeGroup();
    if (key === 'all') {
      return CATALOG_IMAGES;
    }
    return CATALOG_IMAGES.filter((img) => img.groupKey === key);
  });

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  ngOnInit(): void {
    requestAnimationFrame(() => this.revealReady.set(true));
  }

  ngOnDestroy(): void {
    this.menuOpen.set(false);
  }

  onHostScroll(): void {
    this.scrolled.set(this.host.nativeElement.scrollTop > 24);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  setGroup(key: string): void {
    this.activeGroup.set(key);
  }

  trackCatalog(_index: number, item: CatalogImage): string {
    return item.id;
  }

  scrollTo(sectionId: string, event?: Event): void {
    event?.preventDefault();
    this.closeMenu();
    const root = this.host.nativeElement;
    const el = root.querySelector(`#${sectionId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
