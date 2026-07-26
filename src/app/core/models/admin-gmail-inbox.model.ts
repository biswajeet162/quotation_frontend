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
