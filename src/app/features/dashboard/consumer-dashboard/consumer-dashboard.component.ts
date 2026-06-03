import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsumerInquiry } from '../../../core/models/inquiry.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import {
  getConsumerInquiryDisplay,
  getRequestSourceLabel,
} from '../../../shared/utils/inquiry-display.util';

@Component({
  selector: 'app-consumer-dashboard',
  imports: [RouterLink],
  templateUrl: './consumer-dashboard.component.html',
  styleUrl: './consumer-dashboard.component.css',
})
export class ConsumerDashboardComponent implements OnInit {
  private readonly inquiryService = inject(InquiryService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiries = signal<ConsumerInquiry[]>([]);

  readonly getRequestSourceLabel = getRequestSourceLabel;
  readonly getConsumerInquiryDisplay = getConsumerInquiryDisplay;

  readonly total = computed(() => this.inquiries().length);

  readonly submitted = computed(
    () =>
      this.inquiries().filter((q) => q.status === 'NEW' && !q.needsClarification).length,
  );

  readonly actionRequired = computed(
    () => this.inquiries().filter((q) => q.needsClarification).length,
  );

  readonly inProgress = computed(
    () =>
      this.inquiries().filter(
        (q) => q.status === 'SENT_TO_DISTRIBUTORS' || q.status === 'RESPONSES_RECEIVED',
      ).length,
  );

  readonly completed = computed(
    () =>
      this.inquiries().filter((q) => q.status === 'FINAL_SENT' || q.status === 'CLOSED').length,
  );

  readonly recent = computed(() => this.inquiries().slice(0, 5));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getMyInquiries().subscribe({
      next: (list) => {
        this.inquiries.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load your quotation summary.');
      },
    });
  }

  formatDate(iso?: string): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }
}
