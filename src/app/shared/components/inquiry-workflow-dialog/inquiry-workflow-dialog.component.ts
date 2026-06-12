import { Component, computed, HostListener, inject, input, OnInit, output, signal } from '@angular/core';
import { ConsumerInquiry, Inquiry } from '../../../core/models/inquiry.model';
import { InquiryTimelineEntry } from '../../../core/models/inquiry-timeline.model';
import { InquiryService } from '../../../core/services/inquiry/inquiry.service';
import { getRequestSourceLabel } from '../../utils/inquiry-display.util';
import {
  buildAdminInquiryWorkflow,
  formatWorkflowDate,
  workflowStateLabel,
} from '../../utils/inquiry-workflow.util';

@Component({
  selector: 'app-inquiry-workflow-dialog',
  imports: [],
  templateUrl: './inquiry-workflow-dialog.component.html',
  styleUrl: './inquiry-workflow-dialog.component.css',
})
export class InquiryWorkflowDialogComponent implements OnInit {
  private readonly inquiryService = inject(InquiryService);

  readonly inquiry = input.required<Inquiry | ConsumerInquiry>();
  readonly closed = output<void>();
  readonly refreshed = output<void>();

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly entries = signal<InquiryTimelineEntry[]>([]);
  readonly getRequestSourceLabel = getRequestSourceLabel;
  readonly formatWorkflowDate = formatWorkflowDate;
  readonly workflowStateLabel = workflowStateLabel;

  readonly pipelineSteps = computed(() =>
    buildAdminInquiryWorkflow(this.inquiry() as Inquiry),
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  ngOnInit(): void {
    this.loadTimeline();
  }

  loadTimeline(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.inquiryService.getTimeline(this.inquiry().id).subscribe({
      next: (timeline) => {
        this.entries.set(timeline.entries);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Could not load the activity timeline.');
      },
    });
  }

  actorLabel(entry: InquiryTimelineEntry): string {
    if (entry.actorName) {
      return entry.actorName;
    }
    return entry.actorRole ?? 'System';
  }

  kindLabel(kind: string): string {
    switch (kind) {
      case 'MESSAGE':
        return 'Message';
      case 'DISTRIBUTOR':
        return 'Distributor';
      case 'MILESTONE':
        return 'Milestone';
      default:
        return 'Update';
    }
  }

  close(): void {
    this.closed.emit();
  }
}
