import { InquiryRequestSource, InquiryStatus } from './inquiry.model';

export interface InquiryStatusCount {
  status: InquiryStatus;
  label: string;
  count: number;
}

export interface RecentInquiryActivity {
  id: string;
  inquiryId: string;
  title: string;
  companyName?: string;
  status: InquiryStatus;
  requestSource?: InquiryRequestSource;
  needsClarification?: boolean;
  itemCount: number;
  createdAt?: string;
}

export interface ConsumerInquiryVolume {
  companyId: string;
  companyName: string;
  inquiryCount: number;
  pendingCount: number;
}

export interface AdminDashboardOverview {
  totalInquiries: number;
  pendingReview: number;
  awaitingClarification: number;
  sentToDistributors: number;
  responsesReceived: number;
  finalSent: number;
  closed: number;

  catalogSearchInquiries: number;
  newProductSearchInquiries: number;
  mixedInquiries: number;

  consumerCompanies: number;
  distributorCompanies: number;
  adminCompanies: number;

  activeUsers: number;
  adminUsers: number;
  distributorUsers: number;
  consumerUsers: number;

  totalProducts: number;
  distributorProductLinks: number;
  totalInquiryLines: number;
  distributorQuotations: number;
  finalQuotations: number;

  inquiriesByStatus: InquiryStatusCount[];
  recentInquiries: RecentInquiryActivity[];
  topConsumers: ConsumerInquiryVolume[];
}
