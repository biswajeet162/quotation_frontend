import { Component, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConsumerInquiryCreated } from '../../../core/models/inquiry.model';
import { ProductRequestPanelComponent } from '../../products/product-request-panel/product-request-panel.component';

@Component({
  selector: 'app-admin-create-inquiry',
  imports: [ProductRequestPanelComponent],
  templateUrl: './admin-create-inquiry.component.html',
  styleUrl: './admin-create-inquiry.component.css',
})
export class AdminCreateInquiryComponent {
  private readonly router = inject(Router);

  @ViewChild('requestPanel') private requestPanel?: ProductRequestPanelComponent;

  onSubmitted(inquiry: ConsumerInquiryCreated): void {
    if (!inquiry.inquiryId) {
      return;
    }
    void this.router.navigate(['/admin/queries'], {
      queryParams: { inq: inquiry.inquiryId },
    });
  }

  clearForm(): void {
    this.requestPanel?.clearForm();
  }

  openPreview(): void {
    this.requestPanel?.openPreview();
  }

  canPreview(): boolean {
    return (this.requestPanel?.previewRows().length ?? 0) > 0;
  }
}
