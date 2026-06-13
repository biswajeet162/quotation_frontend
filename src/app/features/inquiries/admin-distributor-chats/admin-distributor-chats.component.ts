import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Inquiry, InquiryDistributor } from '../../../core/models/inquiry.model';
import { InquiryTimelineEntry } from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { getRequestSourceLabel } from '../../../shared/utils/inquiry-display.util';
import {
  buildChatTimelineEntries,
  isTimelineNotice,
  noticeDisplayDetail,
  noticeDisplayLabel,
} from '../../../shared/utils/timeline-chat.util';

@Component({
  selector: 'app-admin-distributor-chats',
  imports: [FormsModule],
  templateUrl: './admin-distributor-chats.component.html',
  styleUrl: './admin-distributor-chats.component.css',
})
export class AdminDistributorChatsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly inquiryService = inject(InquiryService);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inquiry = signal<Inquiry | null>(null);
  readonly selectedDistributorCompanyId = signal<string | null>(null);

  readonly timelineLoading = signal(false);
  readonly timelineError = signal<string | null>(null);
  readonly timelineEntries = signal<InquiryTimelineEntry[]>([]);

  readonly messageText = signal('');
  readonly messageLoading = signal(false);
  readonly messageError = signal<string | null>(null);

  readonly distributors = computed(() => {
    const list = this.inquiry()?.distributors ?? [];
    return [...list].sort((a, b) =>
      (a.companyName ?? '').localeCompare(b.companyName ?? '', undefined, { sensitivity: 'base' }),
    );
  });

  readonly selectedDistributor = computed(() => {
    const id = this.selectedDistributorCompanyId();
    if (!id) {
      return null;
    }
    return this.distributors().find((d) => d.companyId === id) ?? null;
  });

  readonly chatTimelineEntries = computed(() =>
    buildChatTimelineEntries(this.timelineEntries()),
  );

  readonly getRequestSourceLabel = getRequestSourceLabel;
  readonly isTimelineNotice = isTimelineNotice;
  readonly noticeDisplayLabel = (entry: InquiryTimelineEntry) =>
    noticeDisplayLabel(entry, 'ADMIN');
  readonly noticeDisplayDetail = (entry: InquiryTimelineEntry) =>
    noticeDisplayDetail(entry, 'ADMIN');

  ngOnInit(): void {
    const inquiryId = this.route.snapshot.paramMap.get('inquiryId');
    if (!inquiryId) {
      this.errorMessage.set('Missing inquiry reference.');
      this.loading.set(false);
      return;
    }
    this.loadInquiry(inquiryId);
  }

  loadInquiry(inquiryId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getById(inquiryId).subscribe({
      next: (inquiry) => {
        this.inquiry.set(inquiry);
        this.loading.set(false);
        const distributors = inquiry.distributors ?? [];
        if (distributors.length > 0) {
          const current = this.selectedDistributorCompanyId();
          const stillSelected =
            current != null && distributors.some((d) => d.companyId === current);
          const nextId = stillSelected ? current! : distributors[0].companyId;
          this.selectDistributor(nextId);
        }
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load this quotation request.');
      },
    });
  }

  selectDistributor(companyId: string): void {
    this.selectedDistributorCompanyId.set(companyId);
    this.messageError.set(null);
    this.loadTimeline();
  }

  loadTimeline(): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    if (!inquiry || !distributorCompanyId) {
      return;
    }

    this.timelineLoading.set(true);
    this.timelineError.set(null);

    this.inquiryService.getDistributorChannelTimeline(inquiry.id, distributorCompanyId).subscribe({
      next: (timeline) => {
        this.timelineEntries.set(timeline.entries ?? []);
        this.timelineLoading.set(false);
      },
      error: () => {
        this.timelineLoading.set(false);
        this.timelineError.set('Could not load distributor messages.');
      },
    });
  }

  sendMessage(): void {
    const inquiry = this.inquiry();
    const distributorCompanyId = this.selectedDistributorCompanyId();
    const text = this.messageText().trim();
    if (!inquiry || !distributorCompanyId || !text) {
      return;
    }

    this.messageLoading.set(true);
    this.messageError.set(null);

    this.inquiryService.postDistributorMessage(inquiry.id, distributorCompanyId, text).subscribe({
      next: () => {
        this.messageLoading.set(false);
        this.messageText.set('');
        this.loadTimeline();
      },
      error: (err) => {
        this.messageLoading.set(false);
        this.messageError.set(err?.error?.message ?? 'Could not send your message.');
      },
    });
  }

  onComposeEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) {
      return;
    }
    keyboardEvent.preventDefault();
    if (this.messageText().trim() && !this.messageLoading()) {
      this.sendMessage();
    }
  }

  isAdminMessage(entry: InquiryTimelineEntry): boolean {
    return entry.actorRole === 'ADMIN';
  }

  isDistributorMessage(entry: InquiryTimelineEntry): boolean {
    return entry.actorRole === 'DISTRIBUTOR';
  }

  canMessage(inquiry: Inquiry): boolean {
    return inquiry.status !== 'CLOSED';
  }

  lineSourceLabel(lineSource?: string): string {
    return lineSource === 'NEW_PRODUCT' ? 'New product' : 'Catalog';
  }

  formatChatTime(iso?: string): string {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  }

  distributorLabel(distributor: InquiryDistributor): string {
    return distributor.companyName ?? 'Distributor';
  }
}
