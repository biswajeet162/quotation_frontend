import { Inquiry, InquiryRequestSource } from '../../core/models/inquiry.model';

export type ConsumerInquiryPhase =
  | 'submitted'
  | 'action_required'
  | 'sent_to_distributors'
  | 'responses_received'
  | 'final_sent'
  | 'closed';

export interface InquiryDisplayStatus {
  phase: ConsumerInquiryPhase;
  label: string;
  description: string;
  tone: 'neutral' | 'warning' | 'success' | 'info';
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

export function getConsumerInquiryDisplay(inquiry: Inquiry): InquiryDisplayStatus {
  if (inquiry.needsClarification) {
    return {
      phase: 'action_required',
      label: 'More information needed',
      description: 'Please see the message below and update your quotation request if needed.',
      tone: 'warning',
    };
  }

  switch (inquiry.status) {
    case 'NEW':
      return {
        phase: 'submitted',
        label: 'Submitted',
        description: 'Your quotation request has been received and is being processed.',
        tone: 'neutral',
      };
    case 'SENT_TO_DISTRIBUTORS':
      return {
        phase: 'sent_to_distributors',
        label: 'With distributors',
        description: 'Your quotation request was sent to distributors.',
        tone: 'info',
      };
    case 'RESPONSES_RECEIVED':
      return {
        phase: 'responses_received',
        label: 'Responses received',
        description: 'Distributors have responded. Your quotation is being prepared.',
        tone: 'info',
      };
    case 'FINAL_SENT':
      return {
        phase: 'final_sent',
        label: 'Quotation ready',
        description: 'Your quotation is ready.',
        tone: 'success',
      };
    case 'CLOSED':
      return {
        phase: 'closed',
        label: 'Closed',
        description: 'This quotation is closed.',
        tone: 'neutral',
      };
    default:
      return {
        phase: 'submitted',
        label: inquiry.status,
        description: '',
        tone: 'neutral',
      };
  }
}
