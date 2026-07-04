import { InquiryItem, InquiryRequestSource, InquiryStatus } from './inquiry.model';

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
  inquiryUuid: string;
  reference: string;
  title: string;
  itemCount: number;
  status: InquiryStatus;
  responseReceived: boolean;
  receivedAt?: string;
}

export interface DistributorInquiry {
  id: string;
  inquiryId: string;
  title: string;
  status: InquiryStatus;
  requestSource?: InquiryRequestSource;
  searchTerm?: string;
  items?: InquiryItem[];
  assignmentId: string;
  responseReceived: boolean;
  receivedAt?: string;
  createdAt?: string;
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
  distributorLogoUrl?: string;
  contacts?: DistributorContactPerson[];
}

export interface DistributorContactPerson {
  id: string;
  name: string;
  email: string;
  phonePrimary: string;
  phoneSecondary?: string;
  primary?: boolean;
}

export interface UpdateDistributorProfileRequest {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface DistributorProductAttachment {
  id: string;
  fileName: string;
  contentType: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  url: string;
}

export interface DistributorBrand {
  brandName: string;
  productCount: number;
  logoUrl?: string;
}

export interface DistributorProductEntry {
  id: string;
  productId: string;
  companyId?: string;
  companyName?: string;
  brand: string;
  designation: string;
  description?: string;
  specifications?: string;
  rsp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  stockQuantity?: number;
  leadTimeDays?: number;
  minOrderQuantity?: number;
  priceValidTill?: string;
  isActive?: boolean;
  attachmentCount?: number;
  attachments?: DistributorProductAttachment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DistributorProductAuditLog {
  id: string;
  distributorProductId: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  actorRole: 'ADMIN' | 'DISTRIBUTOR' | 'CONSUMER';
  action: string;
  summary?: string;
  createdAt?: string;
}

export interface CreateDistributorProductRequest {
  brand: string;
  designation: string;
  description?: string;
  specifications?: string;
  rsp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  stockQuantity?: number;
  leadTimeDays?: number;
  minOrderQuantity?: number;
  priceValidTill?: string;
}

export type UpdateDistributorProductRequest = Partial<CreateDistributorProductRequest> & {
  isActive?: boolean;
};
