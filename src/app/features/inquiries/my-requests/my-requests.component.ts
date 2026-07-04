import { Component, ViewChild } from '@angular/core';
import { ProductRequestPanelComponent } from '../../products/product-request-panel/product-request-panel.component';

@Component({
  selector: 'app-my-requests',
  imports: [ProductRequestPanelComponent],
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.css',
})
export class MyRequestsComponent {
  @ViewChild('requestPanel') private requestPanel?: ProductRequestPanelComponent;

  onSubmitted(): void {
    // Consumer can view submitted requests under Tracking in the sidebar.
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
