import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateDistributorProductRequest,
  DistributorProductEntry,
  UpdateDistributorProductRequest,
} from '../../../core/models/distributor.model';
import { DistributorProductService } from '../../../core/services/distributor/distributor-product.service';

type ProductFormMode = 'create' | 'edit';

interface ProductFormState {
  brand: string;
  designation: string;
  groupName: string;
  category: string;
  description: string;
  specifications: string;
  aliasNames: string;
  rsp: string;
  discountPercentage: string;
  gstPercentage: string;
  stockQuantity: string;
  leadTimeDays: string;
  minOrderQuantity: string;
  priceValidTill: string;
  extraInfo: string;
}

const emptyForm = (): ProductFormState => ({
  brand: '',
  designation: '',
  groupName: '',
  category: '',
  description: '',
  specifications: '',
  aliasNames: '',
  rsp: '',
  discountPercentage: '',
  gstPercentage: '',
  stockQuantity: '0',
  leadTimeDays: '7',
  minOrderQuantity: '1',
  priceValidTill: '',
  extraInfo: '',
});

@Component({
  selector: 'app-distributor-products',
  imports: [FormsModule],
  templateUrl: './distributor-products.component.html',
  styleUrl: './distributor-products.component.css',
})
export class DistributorProductsComponent implements OnInit {
  private readonly productService = inject(DistributorProductService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly products = signal<DistributorProductEntry[]>([]);
  readonly searchQuery = signal('');
  readonly showInactive = signal(false);

  readonly formOpen = signal(false);
  readonly formMode = signal<ProductFormMode>('create');
  readonly editingProduct = signal<DistributorProductEntry | null>(null);
  readonly form = signal<ProductFormState>(emptyForm());

  readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const includeInactive = this.showInactive();

    return this.products().filter((product) => {
      if (!includeInactive && product.isActive === false) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        product.brand,
        product.designation,
        product.category,
        product.groupName,
        product.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.productService.listMine().subscribe({
      next: (list) => {
        this.products.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your products.');
      },
    });
  }

  openCreate(): void {
    this.formMode.set('create');
    this.editingProduct.set(null);
    this.form.set(emptyForm());
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  openEdit(product: DistributorProductEntry): void {
    this.formMode.set('edit');
    this.editingProduct.set(product);
    this.form.set({
      brand: product.brand ?? '',
      designation: product.designation ?? '',
      groupName: product.groupName ?? '',
      category: product.category ?? '',
      description: product.description ?? '',
      specifications: product.specifications ?? '',
      aliasNames: product.aliasNames ?? '',
      rsp: product.rsp != null ? String(product.rsp) : '',
      discountPercentage:
        product.discountPercentage != null ? String(product.discountPercentage) : '',
      gstPercentage: product.gstPercentage != null ? String(product.gstPercentage) : '',
      stockQuantity: product.stockQuantity != null ? String(product.stockQuantity) : '0',
      leadTimeDays: product.leadTimeDays != null ? String(product.leadTimeDays) : '7',
      minOrderQuantity:
        product.minOrderQuantity != null ? String(product.minOrderQuantity) : '1',
      priceValidTill: product.priceValidTill ?? '',
      extraInfo: product.extraInfo ?? '',
    });
    this.actionError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    if (this.saving()) {
      return;
    }
    this.formOpen.set(false);
    this.editingProduct.set(null);
    this.actionError.set(null);
  }

  saveForm(): void {
    const state = this.form();
    if (!state.brand.trim() || !state.designation.trim()) {
      this.actionError.set('Brand and designation are required.');
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);

    if (this.formMode() === 'create') {
      const request = this.toCreateRequest(state);
      this.productService.create(request).subscribe({
        next: (created) => {
          this.products.update((list) => [created, ...list]);
          this.saving.set(false);
          this.formOpen.set(false);
        },
        error: (err) => {
          this.saving.set(false);
          this.actionError.set(err?.error?.message ?? 'Could not add product.');
        },
      });
      return;
    }

    const editing = this.editingProduct();
    if (!editing) {
      this.saving.set(false);
      return;
    }

    const request = this.toUpdateRequest(state);
    this.productService.update(editing.id, request).subscribe({
      next: (updated) => {
        this.products.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.saving.set(false);
        this.formOpen.set(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.actionError.set(err?.error?.message ?? 'Could not update product.');
      },
    });
  }

  toggleActive(product: DistributorProductEntry): void {
    const action = product.isActive
      ? this.productService.deactivate(product.id)
      : this.productService.activate(product.id);

    action.subscribe({
      next: () => {
        this.products.update((list) =>
          list.map((item) =>
            item.id === product.id ? { ...item, isActive: !product.isActive } : item,
          ),
        );
      },
      error: () => {
        this.actionError.set('Could not update product status.');
      },
    });
  }

  updateFormField<K extends keyof ProductFormState>(field: K, value: ProductFormState[K]): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  private toCreateRequest(state: ProductFormState): CreateDistributorProductRequest {
    return {
      brand: state.brand.trim(),
      designation: state.designation.trim(),
      groupName: state.groupName.trim() || undefined,
      category: state.category.trim() || undefined,
      description: state.description.trim() || undefined,
      specifications: state.specifications.trim() || undefined,
      aliasNames: state.aliasNames.trim() || undefined,
      rsp: this.parseNumber(state.rsp),
      discountPercentage: this.parseNumber(state.discountPercentage),
      gstPercentage: this.parseNumber(state.gstPercentage),
      stockQuantity: this.parseInteger(state.stockQuantity, 0),
      leadTimeDays: this.parseInteger(state.leadTimeDays, 7),
      minOrderQuantity: this.parseInteger(state.minOrderQuantity, 1),
      priceValidTill: state.priceValidTill || undefined,
      extraInfo: state.extraInfo.trim() || undefined,
    };
  }

  private toUpdateRequest(state: ProductFormState): UpdateDistributorProductRequest {
    return this.toCreateRequest(state);
  }

  private parseNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseInteger(value: string, fallback: number): number {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
