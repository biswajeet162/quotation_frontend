import { ConsumerFinalResponse, InquiryStatus } from '../../core/models/inquiry.model';

export interface InquiryDealCheck {
  status?: InquiryStatus;
  finalResponses?: ConsumerFinalResponse[];
}

/** True when the consumer confirmed the deal on a final quotation. */
export function inquiryHasConsumerDealDone(inquiry: InquiryDealCheck | null | undefined): boolean {
  if (!inquiry) {
    return false;
  }
  return (inquiry.finalResponses ?? []).some((response) => response.responseType === 'DEAL_DONE');
}
