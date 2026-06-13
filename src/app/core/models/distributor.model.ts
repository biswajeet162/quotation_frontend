export interface DistributorDashboardOverview {
  totalProducts: number;
  activeProducts: number;
  totalInquiriesReceived: number;
  pendingResponses: number;
  responded: number;
  recentInquiries: DistributorInquirySummary[];
}

export interface DistributorInquirySummary {
  assignmentId: string;
  reference: string;
  title: string;
  itemCount: number;
  responseReceived: boolean;
  receivedAt?: string;
}

export interface DistributorProfile {
  userId: string;
  userName: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface DistributorProductEntry {
  id: string;
  productId: string;
  brand: string;
  designation: string;
  groupName?: string;
  category?: string;
  description?: string;
  specifications?: string;
  aliasNames?: string;
  rsp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  stockQuantity?: number;
  leadTimeDays?: number;
  minOrderQuantity?: number;
  priceValidTill?: string;
  extraInfo?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDistributorProductRequest {
  brand: string;
  designation: string;
  groupName?: string;
  category?: string;
  description?: string;
  specifications?: string;
  aliasNames?: string;
  rsp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  stockQuantity?: number;
  leadTimeDays?: number;
  minOrderQuantity?: number;
  priceValidTill?: string;
  extraInfo?: string;
}

export type UpdateDistributorProductRequest = Partial<CreateDistributorProductRequest> & {
  isActive?: boolean;
};
