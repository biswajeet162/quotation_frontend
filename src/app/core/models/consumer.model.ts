export interface ConsumerProfile {
  userId: string;
  userName: string;
  email: string;
  emailVerified?: boolean;
  userPhone?: string;
  phoneVerified?: boolean;
  role: string;
  companyId: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  consumerLogoUrl?: string;
}

export interface UpdateConsumerProfileRequest {
  userName: string;
  userPhone: string;
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
