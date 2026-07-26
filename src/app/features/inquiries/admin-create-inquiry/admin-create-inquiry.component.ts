import { Component, ViewChild } from '@angular/core';
import { ProductRequestPanelComponent } from '../../products/product-request-panel/product-request-panel.component';

@Component({
  selector: 'app-admin-create-inquiry',
  imports: [ProductRequestPanelComponent],
  templateUrl: './admin-create-inquiry.component.html',
  styleUrl: './admin-create-inquiry.component.css',
})
export class AdminCreateInquiryComponent {
  @ViewChild('requestPanel') private requestPanel?: ProductRequestPanelComponent;

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
