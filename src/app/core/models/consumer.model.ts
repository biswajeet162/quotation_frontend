export interface ConsumerProfile {
  userId: string;
  userName: string;
  email: string;
  userPhone?: string;
  role: string;
  companyId: string;
  companyName: string;
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
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}
