import { Component, computed, input } from '@angular/core';

export type DealSealVariant = 'deal' | 'no-deal';

@Component({
  selector: 'app-deal-done-seal',
  template: `
    <span
      class="deal-done-seal"
      [class.deal-done-seal--compact]="compact()"
      [class.deal-done-seal--large]="large()"
      [class.deal-done-seal--no-deal]="variant() === 'no-deal'"
      role="img"
      [attr.aria-label]="variant() === 'no-deal' ? 'Not included in confirmed deal' : 'Deal confirmed'"
    >
      <span class="deal-done-seal-text">{{ sealText() }}</span>
    </span>
  `,
  styleUrl: './deal-done-seal.component.css',
})
export class DealDoneSealComponent {
  readonly compact = input(false);
  readonly large = input(false);
  readonly variant = input<DealSealVariant>('deal');

  sealText(): string {
    return this.variant() === 'no-deal' ? 'NO DEAL' : 'DEAL';
  }
}
