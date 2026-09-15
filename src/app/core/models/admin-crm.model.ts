export interface CrmCustomerSummary {
  id: string;
  serialNumber: number;
  industryName: string;
  sector?: string | null;
  coordinatorName?: string | null;
  remark?: string | null;
  followUpDate?: string | null;
  quarterEnding?: string | null;
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
