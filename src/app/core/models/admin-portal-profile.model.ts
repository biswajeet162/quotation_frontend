export interface AdminPortalProfile {
  userId: string;
  userName: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}

export interface UpdateAdminPortalProfileRequest {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}
