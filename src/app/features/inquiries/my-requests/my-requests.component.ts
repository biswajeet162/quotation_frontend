import { Component } from '@angular/core';
import { ProductRequestPanelComponent } from '../../products/product-request-panel/product-request-panel.component';

@Component({
  selector: 'app-my-requests',
  imports: [ProductRequestPanelComponent],
  templateUrl: './my-requests.component.html',
  styleUrl: './my-requests.component.css',
})
export class MyRequestsComponent {
  onSubmitted(): void {
    // List view will live on a separate tab later.
  }
}
