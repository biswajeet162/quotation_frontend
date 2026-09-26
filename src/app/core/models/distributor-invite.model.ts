export interface CreateDistributorInviteRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface DistributorInviteResponse {
  inviteId: string;
  userId: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  expiresAt: string | null;
  inviteLink: string;
  message: string;
}

export interface DistributorInvitePreview {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  status: string;
  expired: boolean;
  message: string;
}

export interface AcceptDistributorInviteRequest {
  token: string;
  name: string;
  phone: string;
  password?: string;
  confirmPassword?: string;
  gstNumber?: string;
  panNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  acceptedInvite: boolean;
}
