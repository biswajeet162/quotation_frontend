import { Inquiry, InquiryRequestSource } from '../../core/models/inquiry.model';

export type ConsumerInquiryPhase =
  | 'submitted'
  | 'action_required'
  | 'sent_to_distributors'
  | 'responses_received'
  | 'final_sent'
  | 'closed';

export type InquiryListStep = 'grey' | 'yellow' | 'green';

export function formatExpectedDeliveryDate(iso?: string): string {
  if (!iso?.trim()) {
    return '—';
  }
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}-${month}-${year}`;
}

export interface InquiryDisplayStatus {
  phase: ConsumerInquiryPhase;
  label: string;
  description: string;
  tone: 'neutral' | 'warning' | 'success' | 'info';
  listStep: InquiryListStep;
}

export function getRequestSourceLabel(source?: InquiryRequestSource): string {
  switch (source) {
    case 'CATALOG_SEARCH':
      return 'Catalog search';
    case 'NEW_PRODUCT_SEARCH':
      return 'New product from search';
    case 'MIXED':
      return 'Catalog + new product';
    default:
      return 'Quotation request';
  }
}

export function getInquiryListStep(inquiry: Pick<Inquiry, 'status'>): InquiryListStep {
  if (inquiry.status === 'CLOSED') {
    return 'green';
  }
  if (
    inquiry.status === 'SENT_TO_DISTRIBUTORS' ||
    inquiry.status === 'RESPONSES_RECEIVED' ||
    inquiry.status === 'FINAL_SENT'
  ) {
    return 'yellow';
  }
  return 'grey';
}

export function getAdminInquiryListLabel(
  inquiry: Pick<Inquiry, 'status' | 'needsClarification'>,
): string {
  if (inquiry.needsClarification) {
    return 'Action required';
  }

  switch (inquiry.status) {
    case 'NEW':
      return 'Submitted';
    case 'SENT_TO_DISTRIBUTORS':
      return 'With distributors';
    case 'RESPONSES_RECEIVED':
      return 'Responses received';
    case 'FINAL_SENT':
      return 'Quotation ready';
    case 'CLOSED':
      return 'Closed';
    default:
      return inquiry.status;
  }
}

export function getConsumerInquiryDisplay(
  inquiry: Pick<Inquiry, 'status' | 'needsClarification'>,
): InquiryDisplayStatus {
  const listStep = getInquiryListStep(inquiry);

  if (inquiry.needsClarification) {
    return {
      phase: 'action_required',
      label: 'More information needed',
      description: 'Please see the message below and update your quotation request if needed.',
      tone: 'warning',
      listStep,
    };
  }

  switch (inquiry.status) {
    case 'NEW':
      return {
        phase: 'submitted',
        label: 'Submitted',
        description: 'Your quotation request has been received and is being processed.',
        tone: 'neutral',
        listStep,
      };
    case 'SENT_TO_DISTRIBUTORS':
      return {
        phase: 'sent_to_distributors',
        label: 'Checking our inventory',
        description: 'We are checking product availability for your request.',
        tone: 'warning',
        listStep,
      };
    case 'RESPONSES_RECEIVED':
      return {
        phase: 'responses_received',
        label: 'Preparing your quotation',
        description: 'We are preparing your quotation.',
        tone: 'info',
        listStep,
      };
    case 'FINAL_SENT':
      return {
        phase: 'final_sent',
        label: 'Quotation ready',
        description: 'Your quotation is ready.',
        tone: 'success',
        listStep,
      };
    case 'CLOSED':
      return {
        phase: 'closed',
        label: 'Closed',
        description: 'This quotation is closed.',
        tone: 'success',
        listStep,
      };
    default:
      return {
        phase: 'submitted',
        label: inquiry.status,
        description: '',
        tone: 'neutral',
        listStep,
      };
  }
}
