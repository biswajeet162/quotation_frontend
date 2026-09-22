export interface CrmCustomerSummary {
  id: string;
  serialNumber: number;
  industryName: string;
  sector?: string | null;
  location?: string | null;
  purchaserName?: string | null;
  purchaserPhone?: string | null;
  purchaserEmail?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
  followUpDate?: string | null;
  meetingDate?: string | null;
  workflowStatus?: 'NONE' | 'REVIEW' | 'DONE' | string | null;
  /** True when purchaser or maintenance contact phone is present. */
  hasContacts?: boolean;
  isActive: boolean;
  updatedAt?: string;
  createdAt?: string;
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
  meetingDate?: string | null;
  followUpDate?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
  workflowStatus?: 'NONE' | 'REVIEW' | 'DONE' | string | null;
  isActive: boolean;
  createdByUserId?: string | null;
  createdByName?: string | null;
  createdByRole?: string | null;
  updatedByUserId?: string | null;
  updatedByName?: string | null;
  updatedByRole?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export function crmHasContactPhone(customer: {
  purchaserPhone?: string | null;
  maintenancePhone?: string | null;
}): boolean {
  return Boolean(customer.purchaserPhone?.trim() || customer.maintenancePhone?.trim());
}

export function crmHasFollowUpDate(row: { followUpDate?: string | null }): boolean {
  return Boolean(row.followUpDate?.trim());
}

export function crmHasMeetingDate(row: { meetingDate?: string | null }): boolean {
  return Boolean(row.meetingDate?.trim());
}
