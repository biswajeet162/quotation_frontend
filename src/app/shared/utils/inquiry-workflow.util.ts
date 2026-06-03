import { Inquiry, InquiryDistributor, InquiryStatus } from '../../core/models/inquiry.model';

export type WorkflowStepState = 'completed' | 'current' | 'upcoming' | 'skipped';

export interface InquiryWorkflowStep {
  id: string;
  label: string;
  description: string;
  state: WorkflowStepState;
  detail?: string;
}

const STATUS_ORDER: Record<InquiryStatus, number> = {
  NEW: 0,
  SENT_TO_DISTRIBUTORS: 1,
  RESPONSES_RECEIVED: 2,
  FINAL_SENT: 3,
  CLOSED: 4,
};

function statusIndex(status: InquiryStatus): number {
  return STATUS_ORDER[status] ?? 0;
}

function distributorStats(distributors?: InquiryDistributor[]): string | undefined {
  if (!distributors?.length) {
    return undefined;
  }
  const total = distributors.length;
  const emailed = distributors.filter((d) => d.emailSent).length;
  const responded = distributors.filter((d) => d.responseReceived).length;
  return `${total} distributor(s) · ${emailed} emailed · ${responded} responded`;
}

/** Admin-facing pipeline for a single inquiry (derived from current status and flags). */
export function buildAdminInquiryWorkflow(inquiry: Inquiry): InquiryWorkflowStep[] {
  const order = statusIndex(inquiry.status);
  const needsClarification = !!inquiry.needsClarification;
  const distDetail = distributorStats(inquiry.distributors);

  const steps: InquiryWorkflowStep[] = [
    {
      id: 'submitted',
      label: 'Consumer submitted',
      description: 'Quotation request received from the consumer company.',
      state: 'completed',
      detail: inquiry.createdAt
        ? `Submitted ${formatWorkflowDate(inquiry.createdAt)}`
        : undefined,
    },
    {
      id: 'admin_review',
      label: 'Admin review',
      description: 'Review products, notes, and search context before dispatch.',
      state: resolveAdminReviewState(order, needsClarification),
    },
    {
      id: 'clarification',
      label: 'Consumer clarification',
      description: 'Admin requested more details; consumer must respond.',
      state: resolveClarificationState(order, needsClarification),
      detail: needsClarification ? inquiry.clarificationMessage : undefined,
    },
    {
      id: 'sent_distributors',
      label: 'Sent to distributors',
      description: 'Inquiry routed to distributors who carry the requested products.',
      state: resolvePipelineState(order, 1, inquiry.status === 'SENT_TO_DISTRIBUTORS'),
      detail: order >= 1 ? distDetail : undefined,
    },
    {
      id: 'responses',
      label: 'Distributor responses',
      description: 'Collecting pricing and availability from distributors.',
      state: resolvePipelineState(order, 2, inquiry.status === 'RESPONSES_RECEIVED'),
      detail: order >= 2 ? distDetail : undefined,
    },
    {
      id: 'final',
      label: 'Final quotation',
      description: 'Consolidated quotation prepared for the consumer.',
      state: resolvePipelineState(order, 3, inquiry.status === 'FINAL_SENT'),
    },
    {
      id: 'closed',
      label: 'Closed',
      description: 'Request completed or archived.',
      state: inquiry.status === 'CLOSED' ? 'completed' : order > 4 ? 'completed' : 'upcoming',
    },
  ];

  return steps;
}

function resolveAdminReviewState(order: number, needsClarification: boolean): WorkflowStepState {
  if (needsClarification) {
    return 'completed';
  }
  if (order === 0) {
    return 'current';
  }
  return 'completed';
}

function resolveClarificationState(order: number, needsClarification: boolean): WorkflowStepState {
  if (!needsClarification && order === 0) {
    return 'skipped';
  }
  if (needsClarification) {
    return 'current';
  }
  if (order >= 1) {
    return 'completed';
  }
  return 'upcoming';
}

function resolvePipelineState(
  order: number,
  stepIndex: number,
  isExactStatus: boolean,
): WorkflowStepState {
  if (order > stepIndex) {
    return 'completed';
  }
  if (order === stepIndex && isExactStatus) {
    return 'current';
  }
  if (order === stepIndex) {
    return 'current';
  }
  return 'upcoming';
}

export function formatWorkflowDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function workflowStateLabel(state: WorkflowStepState): string {
  switch (state) {
    case 'completed':
      return 'Done';
    case 'current':
      return 'In progress';
    case 'skipped':
      return 'Not required';
    default:
      return 'Pending';
  }
}
