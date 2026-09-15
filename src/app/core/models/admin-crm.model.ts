export interface CrmCustomerSummary {
  id: string;
  serialNumber: number;
  industryName: string;
  sector?: string | null;
  location?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
  followUpDate?: string | null;
  meetingDate?: string | null;
  isActive: boolean;
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
  quarterEnding?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
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
  quarterEnding?: string | null;
  coordinatorName?: string;
  remark?: string;
}

export interface UpdateCrmCustomerRequest extends CreateCrmCustomerRequest {
  isActive: boolean;
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

export interface CrmChangeHistoryDay {
  date: string;
  changeCount: number;
  changes: CrmChangeLogEntry[];
}
