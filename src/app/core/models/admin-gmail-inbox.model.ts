export type ExternalEmailStatus = 'UNLINKED' | 'LINKED' | 'DISMISSED' | 'CONVERTED';

export interface ExternalEmailInboxItem {
  id: string;
  gmailMessageId: string;
  gmailThreadId?: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  bodyPreview?: string;
  receivedAt: string;
  status: ExternalEmailStatus;
  linkedInquiryId?: string;
  linkedAt?: string;
}

export interface GmailSyncStatus {
  enabled: boolean;
  configured: boolean;
  mailbox: string;
  pollIntervalMinutes: number;
  syncSentFolder: boolean;
  historyId?: string;
  lastPollAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  unlinkedEmailCount: number;
  healthStatus?: string;
  healthMessage?: string;
  minutesSinceLastSuccess?: number;
  tokenHealthy?: boolean;
}

export interface GmailSyncRunResult {
  dryRun: boolean;
  fetchedCount: number;
  linkedCount: number;
  unlinkedCount: number;
  skippedCount: number;
  alreadyProcessedCount: number;
  message: string;
}

export interface LinkExternalEmailResult {
  inboxId: string;
  inquiryId: string;
  communicationId?: string;
  communicationCreated: boolean;
  linkedAt: string;
}

export interface LinkExternalEmailRequest {
  inquiryId: string;
}

export interface ConvertExternalEmailSuggestions {
  suggestedTitle: string;
  suggestedDescription?: string;
  suggestedContactEmail: string;
  suggestedContactName: string;
  suggestedCompanyName: string;
  suggestedBrand?: string;
  suggestedDesignation?: string;
  matchedConsumerCompanyId?: string;
  matchedConsumerUserId?: string;
  matchedConsumerCompanyName?: string;
}

export interface ConvertExternalEmailToInquiryRequest {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  consumerCompanyId?: string;
  consumerUserId?: string;
  title: string;
  description?: string;
  brand?: string;
  designation?: string;
  productNotes?: string;
}

export interface ConvertExternalEmailToInquiryResult {
  inboxId: string;
  inquiryId: string;
  inquiryUuid: string;
  communicationId?: string;
  communicationCreated: boolean;
  convertedAt: string;
}
