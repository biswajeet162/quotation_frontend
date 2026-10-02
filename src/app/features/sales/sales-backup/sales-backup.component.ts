import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCrmService } from '../../../core/services/admin/admin-crm.service';
import { ToastService } from '../../../core/services/toast/toast.service';
import { extractApiErrorMessage } from '../../../core/utils/api-error.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-sales-backup',
  imports: [RouterLink, LoadingOverlayComponent],
  templateUrl: './sales-backup.component.html',
  styleUrl: './sales-backup.component.css',
})
export class SalesBackupComponent {
  private readonly crmService = inject(AdminCrmService);
  private readonly toast = inject(ToastService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('excelInput');

  readonly downloading = signal(false);
  readonly uploading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly lastImportMessage = signal<string | null>(null);

  readonly overlayLoading = () => this.downloading() || this.uploading();
  readonly overlayMessage = () =>
    this.uploading() ? 'Uploading Excel…' : this.downloading() ? 'Preparing Excel…' : 'Working…';

  triggerExcelPicker(): void {
    if (this.uploading() || this.downloading()) {
      return;
    }
    this.fileInput()?.nativeElement.click();
  }

  onExcelSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.errorMessage.set('Upload a .xlsx or .xls Excel file.');
      this.toast.error('Upload a .xlsx or .xls Excel file.');
      return;
    }

    this.uploading.set(true);
    this.errorMessage.set(null);
    this.lastImportMessage.set(null);

    this.crmService.uploadExcel(file, true).subscribe({
      next: (result) => {
        this.uploading.set(false);
        const message =
          result.message ||
          `Imported ${result.imported} row(s). Data is now live in CRM and Follow-up.`;
        this.lastImportMessage.set(message);
        this.toast.success(message);
      },
      error: (err) => {
        this.uploading.set(false);
        const message = extractApiErrorMessage(err, 'Could not upload Excel file.');
        this.errorMessage.set(message);
        this.toast.fromApiError(err, 'Could not upload Excel file.');
      },
    });
  }

  downloadBackup(): void {
    if (this.downloading() || this.uploading()) {
      return;
    }
    this.downloading.set(true);
    this.errorMessage.set(null);

    this.crmService.downloadExcel().subscribe({
      next: (blob) => {
        this.downloading.set(false);
        this.saveBlob(blob, this.defaultFilename());
        this.toast.success('CRM + Follow-up Excel downloaded.');
      },
      error: (err) => {
        this.downloading.set(false);
        const message = extractApiErrorMessage(err, 'Could not download Excel backup.');
        this.errorMessage.set(message);
        this.toast.fromApiError(err, 'Could not download Excel backup.');
      },
    });
  }

  private defaultFilename(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `crm-backup-${yyyy}-${mm}-${dd}.xlsx`;
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
