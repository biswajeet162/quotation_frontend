export interface AdminConsumerCompanySummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  isActive?: boolean;
  employeeCount: number;
  hasLogo: boolean;
  createdAt?: string;
}

export interface AdminConsumerEmployee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
}

export interface AdminConsumerCompanyDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  isActive?: boolean;
  consumerLogoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  employees: AdminConsumerEmployee[];
}

export interface CreateAdminConsumerCompanyRequest {
  name: string;
  email: string;
  phone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}

export interface UpdateAdminConsumerCompanyRequest extends CreateAdminConsumerCompanyRequest {
  isActive?: boolean;
}

export interface CreateAdminConsumerEmployeeRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface ConsumerCompanyOption {
  id: string;
  name: string;
}
