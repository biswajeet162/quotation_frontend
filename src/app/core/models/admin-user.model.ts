export type UserRole = 'ADMIN' | 'DISTRIBUTOR' | 'CONSUMER';

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCompany {
  id?: string;
  name: string;
  companyType?: string;
  gstNumber?: string;
  panNumber?: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  emailVerified?: boolean;
  hasGoogleAccount?: boolean;
  createdAt?: string;
  updatedAt?: string;
  company?: AdminCompany;
}

export interface CreateAdminUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface UpdateAdminUserRequest {
  name: string;
  email: string;
  password?: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}
