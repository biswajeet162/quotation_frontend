import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  OnboardingBrandOption,
  OnboardingCategoryOption,
} from '../../../core/models/distributor-onboarding.model';
import { DistributorOnboardingService } from '../../../core/services/distributor/distributor-onboarding.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-distributor-onboarding',
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './distributor-onboarding.component.html',
  styleUrl: './distributor-onboarding.component.css',
})
export class DistributorOnboardingComponent implements OnInit {
  private readonly onboarding = inject(DistributorOnboardingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly step = signal<1 | 2>(1);
  readonly errorMessage = signal<string | null>(null);

  readonly brandOptions = signal<OnboardingBrandOption[]>([]);
  readonly categoryOptions = signal<OnboardingCategoryOption[]>([]);
  readonly selectedBrands = signal<string[]>([]);
  readonly customBrand = signal('');
  /** brandName → category ids */
  readonly categoriesByBrand = signal<Record<string, string[]>>({});
  readonly activeBrandForCategories = signal<string | null>(null);

  readonly overlayLoading = computed(() => this.loading() || this.saving());
  readonly canContinueToCategories = computed(() => this.selectedBrands().length > 0);
  readonly canSubmit = computed(() => {
    const brands = this.selectedBrands();
    if (brands.length === 0) {
      return false;
    }
    const map = this.categoriesByBrand();
    return brands.every((brand) => (map[brand]?.length ?? 0) > 0);
  });

  ngOnInit(): void {
    this.onboarding.getOptions().subscribe({
      next: (options) => {
        this.brandOptions.set(options.brands ?? []);
        this.categoryOptions.set(options.categories ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        const message = extractApiErrorMessage(err, 'Could not load onboarding options.');
        this.errorMessage.set(message);
        this.toast.fromApiError(err, message);
      },
    });
  }

  isBrandSelected(name: string): boolean {
    return this.selectedBrands().includes(name);
  }

  toggleBrand(name: string): void {
    this.selectedBrands.update((current) => {
      if (current.includes(name)) {
        this.categoriesByBrand.update((map) => {
          const next = { ...map };
          delete next[name];
          return next;
        });
        return current.filter((item) => item !== name);
      }
      return [...current, name];
    });
  }

  addCustomBrand(): void {
    const name = this.customBrand().trim();
    if (!name) {
      return;
    }
    if (!this.selectedBrands().includes(name)) {
      this.selectedBrands.update((current) => [...current, name]);
    }
    this.customBrand.set('');
  }

  goToCategories(): void {
    if (!this.canContinueToCategories()) {
      this.errorMessage.set('Select at least one brand to continue.');
      return;
    }
    this.errorMessage.set(null);
    const brands = this.selectedBrands();
    this.activeBrandForCategories.set(brands[0] ?? null);
    this.step.set(2);
  }

  goToBrands(): void {
    this.errorMessage.set(null);
    this.step.set(1);
  }

  setActiveBrand(name: string): void {
    this.activeBrandForCategories.set(name);
  }

  isCategorySelected(brand: string, categoryId: string): boolean {
    return (this.categoriesByBrand()[brand] ?? []).includes(categoryId);
  }

  toggleCategory(brand: string, categoryId: string): void {
    this.categoriesByBrand.update((map) => {
      const current = map[brand] ?? [];
      const next = current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId];
      return { ...map, [brand]: next };
    });
  }

  categoryCount(brand: string): number {
    return this.categoriesByBrand()[brand]?.length ?? 0;
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.errorMessage.set('Pick at least one product category for each brand.');
      return;
    }

    const map = this.categoriesByBrand();
    const payload = {
      brands: this.selectedBrands().map((name) => ({
        name,
        categories: map[name] ?? [],
      })),
    };

    this.saving.set(true);
    this.errorMessage.set(null);
    this.onboarding.complete(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Catalog preferences saved. Your brands are ready.');
        void this.router.navigate(['/distributor/products/my-products']);
      },
      error: (err) => {
        this.saving.set(false);
        const message = extractApiErrorMessage(err, 'Could not save onboarding. Please try again.');
        this.errorMessage.set(message);
        this.toast.fromApiError(err, message);
      },
    });
  }
}
