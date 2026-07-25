import { Component, input } from '@angular/core';

@Component({
  selector: 'app-deal-done-seal',
  template: `
    <span
      class="deal-done-seal"
      [class.deal-done-seal--compact]="compact()"
      role="img"
      aria-label="Deal confirmed"
    >
      <span class="deal-done-seal-text">DEAL</span>
    </span>
  `,
  styleUrl: './deal-done-seal.component.css',
})
export class DealDoneSealComponent {
  readonly compact = input(false);
}
