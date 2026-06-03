import { Component, HostListener, input, output, computed } from '@angular/core';
import { Inquiry } from '../../../core/models/inquiry.model';
import { getRequestSourceLabel } from '../../utils/inquiry-display.util';
import {
  buildAdminInquiryWorkflow,
  formatWorkflowDate,
  workflowStateLabel,
} from '../../utils/inquiry-workflow.util';

@Component({
  selector: 'app-inquiry-workflow-dialog',
  templateUrl: './inquiry-workflow-dialog.component.html',
  styleUrl: './inquiry-workflow-dialog.component.css',
})
export class InquiryWorkflowDialogComponent {
  readonly inquiry = input.required<Inquiry>();
  readonly closed = output<void>();

  readonly getRequestSourceLabel = getRequestSourceLabel;
  readonly formatWorkflowDate = formatWorkflowDate;
  readonly workflowStateLabel = workflowStateLabel;

  readonly steps = computed(() => buildAdminInquiryWorkflow(this.inquiry()));

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
