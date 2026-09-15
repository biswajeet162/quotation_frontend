export interface CrmCustomer {
  id: string;
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
  coordinatorName?: string;
  remark?: string;
}

export interface UpdateCrmCustomerRequest extends CreateCrmCustomerRequest {
  isActive: boolean;
}
