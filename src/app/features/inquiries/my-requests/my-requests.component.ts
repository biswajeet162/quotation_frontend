import { Component, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConsumerInquiryCreated } from '../../../core/models/inquiry.model';
import { ProductRequestPanelComponent } from '../../products/product-request-panel/product-request-panel.component';

@Component({
  selector: 'app-my-requests',
  imports: [ProductRequestPanelComponent],
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.css',
})
export class MyRequestsComponent {
  private readonly router = inject(Router);

  @ViewChild('requestPanel') private requestPanel?: ProductRequestPanelComponent;

  onSubmitted(inquiry: ConsumerInquiryCreated): void {
    if (!inquiry.inquiryId) {
      return;
    }
    void this.router.navigate(['/tracking'], {
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
