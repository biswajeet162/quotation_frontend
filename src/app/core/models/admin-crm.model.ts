export interface CrmContact {
  id?: string | null;
  sortOrder: number;
  rankLabel?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface CrmContactFormRow {
  /** Stable UI key for drag/reorder tracking. */
  key: string;
  name: string;
  phone: string;
  email: string;
}

export const CRM_MAX_CONTACTS = 7;

export const CRM_CONTACT_RANK_LABELS = [
  'Primary',
  'Secondary',
  'Tertiary',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
] as const;

let crmContactKeySeq = 0;

export function nextCrmContactKey(): string {
  crmContactKeySeq += 1;
  return `crm-contact-${Date.now()}-${crmContactKeySeq}`;
}

export function crmContactRankLabel(index: number): string {
  return CRM_CONTACT_RANK_LABELS[index] ?? `Contact ${index + 1}`;
}

export function emptyCrmContactRow(): CrmContactFormRow {
  return { key: nextCrmContactKey(), name: '', phone: '', email: '' };
}

export function crmContactsToFormRows(
  contacts: CrmContact[] | null | undefined,
  fallback?: { name?: string | null; phone?: string | null; email?: string | null },
): CrmContactFormRow[] {
  if (contacts && contacts.length > 0) {
    return contacts.slice(0, CRM_MAX_CONTACTS).map((c) => ({
      key: nextCrmContactKey(),
      name: c.name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
    }));
  }
  if (fallback && (fallback.name?.trim() || fallback.phone?.trim() || fallback.email?.trim())) {
    return [
      {
        key: nextCrmContactKey(),
        name: fallback.name ?? '',
        phone: fallback.phone ?? '',
        email: fallback.email ?? '',
      },
    ];
  }
  return [emptyCrmContactRow()];
}

export function crmFormRowsToRequest(rows: CrmContactFormRow[]): Array<{
  name?: string;
  phone?: string;
  email?: string;
}> {
  return rows
    .map((row) => ({
      name: row.name.trim() || undefined,
      phone: row.phone.trim() || undefined,
      email: row.email.trim() || undefined,
    }))
    .filter((row) => row.name || row.phone || row.email)
    .slice(0, CRM_MAX_CONTACTS);
}

export interface CrmCustomerSummary {
  id: string;
  serialNumber: number;
  industryName: string;
  sector?: string | null;
  location?: string | null;
  purchaserName?: string | null;
  purchaserPhone?: string | null;
  purchaserEmail?: string | null;
  maintenanceName?: string | null;
  maintenancePhone?: string | null;
  maintenanceEmail?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
  followUpDate?: string | null;
  meetingDate?: string | null;
  workflowStatus?: 'NONE' | 'REVIEW' | 'DONE' | string | null;
  /** True once marked Done — permanently under Follow-up, never CRM. */
  followUpEntered?: boolean;
  /** True when purchaser or maintenance contact phone is present. */
  hasContacts?: boolean;
  /** Server-built blob of all fields + contacts for deep search. */
  searchText?: string | null;
  isActive: boolean;
  updatedAt?: string;
  createdAt?: string;
  /** When the row was last opened in CRM — newer floats to top. */
  lastOpenedAt?: string | null;
}

export interface CrmCustomer {
  id: string;
  serialNumber?: number;
  industryName: string;
  sector?: string | null;
  location?: string | null;
  purchaserName?: string | null;
  purchaserPhone?: string | null;
  purchaserEmail?: string | null;
  maintenanceName?: string | null;
  maintenancePhone?: string | null;
  maintenanceEmail?: string | null;
  purchasers?: CrmContact[] | null;
  maintenanceContacts?: CrmContact[] | null;
  meetingDate?: string | null;
  followUpDate?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
  workflowStatus?: 'NONE' | 'REVIEW' | 'DONE' | string | null;
  /** True once marked Done — permanently under Follow-up, never CRM. */
  followUpEntered?: boolean;
  isActive: boolean;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  updatedByUserId?: string | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastOpenedAt?: string | null;
}

export interface CreateCrmCustomerRequest {
  industryName: string;
  sector?: string;
  location?: string;
  purchaserName?: string;
  purchaserPhone?: string;
  purchaserEmail?: string;
  maintenanceName?: string;
  maintenancePhone?: string;
  maintenanceEmail?: string;
  purchasers?: Array<{ name?: string; phone?: string; email?: string }>;
  maintenanceContacts?: Array<{ name?: string; phone?: string; email?: string }>;
  meetingDate?: string | null;
  followUpDate?: string | null;
  coordinatorName?: string;
  remark?: string;
}

export interface UpdateCrmCustomerRequest extends CreateCrmCustomerRequest {
  isActive: boolean;
}

export interface CrmFollowUpEntry {
  id: string;
  customerId: string;
  followUpDate: string;
  remark?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  createdAt?: string;
}

export interface CrmExcelUploadResult {
  imported: number;
  skipped: number;
  replacedExisting: boolean;
  message: string;
}

export interface CrmImportBatch {
  id: string;
  fileName: string;
  recordCount: number;
  uploadedByName?: string | null;
  uploadedByRole?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CrmChangeLogEntry {
  id: string;
  customerId: string;
  industryName: string;
  fieldName: string;
  fieldLabel: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  changedAt: string;
}

export interface CrmChangeEdit {
  batchId: string;
  customerId?: string | null;
  industryName: string;
  eventType: 'FIELD_CHANGE' | 'EXCEL_UPLOAD' | 'EXCEL_ACTIVATE' | string;
  sourceFileName?: string | null;
  changedByName?: string | null;
  changedByRole?: string | null;
  changedByRoleLabel?: string | null;
  changedAt: string;
  fieldCount: number;
  summary: string;
  oldValue?: string | null;
  newValue?: string | null;
  changes: CrmChangeLogEntry[];
}

export interface CrmChangeHistoryDay {
  date: string;
  editCount: number;
  edits: CrmChangeEdit[];
}

export function crmWorkflowStatus(
  customer: { workflowStatus?: string | null },
): 'NONE' | 'REVIEW' | 'DONE' {
  const value = customer.workflowStatus?.trim().toUpperCase();
  if (value === 'REVIEW' || value === 'DONE') {
    return value;
  }
  return 'NONE';
}

/** Permanently in Follow-up after first Done — never returns to CRM. */
export function crmFollowUpEntered(customer: {
  followUpEntered?: boolean | null;
  workflowStatus?: string | null;
}): boolean {
  if (customer.followUpEntered === true) return true;
  return crmWorkflowStatus(customer) === 'DONE';
}

export function crmHasContactPhone(customer: {
  purchaserPhone?: string | null;
  maintenancePhone?: string | null;
  purchasers?: CrmContact[] | null;
  maintenanceContacts?: CrmContact[] | null;
}): boolean {
  if (customer.purchaserPhone?.trim() || customer.maintenancePhone?.trim()) {
    return true;
  }
  const fromPurchasers = customer.purchasers?.some((c) => c.phone?.trim());
  const fromMaintenance = customer.maintenanceContacts?.some((c) => c.phone?.trim());
  return Boolean(fromPurchasers || fromMaintenance);
}

export function crmHasFollowUpDate(row: { followUpDate?: string | null }): boolean {
  return Boolean(row.followUpDate?.trim());
}

export function crmHasMeetingDate(row: { meetingDate?: string | null }): boolean {
  return Boolean(row.meetingDate?.trim());
}
