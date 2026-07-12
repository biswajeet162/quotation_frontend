export type InquiryStatus =
  | 'NEW'
  | 'SENT_TO_DISTRIBUTORS'
  | 'RESPONSES_RECEIVED'
  | 'FINAL_SENT'
  | 'CLOSED';

export type InquiryRequestSource = 'CATALOG_SEARCH' | 'NEW_PRODUCT_SEARCH' | 'MIXED';

export type InquiryLineSource = 'CATALOG_MATCH' | 'NEW_PRODUCT';

export interface InquiryItemAttachment {
  id: string;
  fileName: string;
  contentType: string;
  thumbnailUrl: string;
  originalUrl: string;
}

export interface InquiryItem {
  id?: string;
  productId: string;
  productBrand?: string;
  productName?: string;
  productSpecifications?: string;
  productDescription?: string;
  quantity: number;
  notes?: string;
  expectedDeliveryDate?: string;
  lineSource?: InquiryLineSource;
  attachments?: InquiryItemAttachment[];
  adminHsnCode?: string;
  adminDescription?: string;
  adminMrp?: number;
  adminDiscountPercentage?: number;
  adminGstPercentage?: number;
  distributorHsnCode?: string;
  distributorMrp?: number;
  distributorDiscountPercentage?: number;
  distributorGstPercentage?: number;
  distributorOurDeliveryDate?: string;
}

/** Returned to consumers after POST /inquiries (no admin/line-item payload). */
export interface ConsumerInquiryCreated {
  id?: string;
  inquiryId: string;
  status: InquiryStatus;
  acknowledgementEmailSent?: boolean;
  acknowledgementEmailMessage?: string;
  pdfDownloadUrl?: string;
}

/** Consumer-safe inquiry view for GET /inquiries/my and related endpoints. */
export interface ConsumerInquiry {
  id: string;
  inquiryId: string;
  title: string;
  description?: string;
  status: InquiryStatus;
  requestSource?: InquiryRequestSource;
  searchTerm?: string;
  needsClarification?: boolean;
  clarificationMessage?: string;
  items?: InquiryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InquiryDistributor {
  id?: string;
  companyId: string;
  companyName?: string;
  email?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  responseReceived?: boolean;
  responseReceivedAt?: string;
  matchedBrands?: string[];
  assignedItemCount?: number;
  requotationRequested?: boolean;
  requotationRequestedAt?: string;
  requotationNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Chronological quote / re-quote history for one distributor assignment. */
export interface DistributorQuotationHistoryEntry {
  type: 'QUOTATION' | 'REQUOTE_REQUEST' | string;
  round?: number;
  occurredAt?: string;
  note?: string;
  items?: InquiryItem[];
}

export interface Inquiry {
  id: string;
  inquiryId: string;
  companyId: string;
  companyName?: string;
  title: string;
  description?: string;
  status: InquiryStatus;
  needsClarification?: boolean;
  clarificationMessage?: string;
  requestSource?: InquiryRequestSource;
  searchTerm?: string;
  items?: InquiryItem[];
  distributors?: InquiryDistributor[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateInquiryRequest {
  title: string;
  description?: string;
  searchTerm?: string;
  draftSessionId?: string;
  items: {
    productId: string;
    quantity: number;
    notes?: string;
    expectedDeliveryDate?: string;
    lineSource?: InquiryLineSource;
    rowClientId?: string;
    attachmentIds?: string[];
  }[];
}

export interface InquiryDraftAttachment {
  id: string;
  draftSessionId: string;
  rowClientId: string;
  fileName: string;
  contentType: string;
  thumbnailUrl: string;
  originalUrl: string;
}

export interface FindOrCreateProductRequest {
  brand: string;
  designation: string;
  description?: string;
  specifications?: string;
}

export interface QuoteCartLine {
  productId: string;
  brand: string;
  designation: string;
  quantity: number;
  lineNotes: string;
  lineSource: InquiryLineSource;
}

export interface DistributorProductOption {
  productId: string;
  brand: string;
  designation: string;
  rsp?: number;
  stockQuantity?: number;
  leadTimeDays?: number;
}

export interface DistributorOption {
  companyId: string;
  companyName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  productCount: number;
  products: DistributorProductOption[];
  matchedBrands?: string[];
  matchedItemCount?: number;
}

export interface BrandRoutingPreview {
  inquiryBrands: string[];
  uncoveredBrands: string[];
  distributors: DistributorOption[];
  matchedDistributorCount: number;
}

export interface AdminInquiryLinePricing {
  inquiryItemId: string;
  hsnCode?: string;
  description?: string;
  mrp?: number;
  discountPercentage?: number;
  gstPercentage?: number;
  expectedDeliveryDate?: string;
}

export interface SubmitToDistributorsRequest {
  /** Optional; when omitted, backend auto-routes by brand. */
  distributorCompanyIds?: string[];
  linePricing?: AdminInquiryLinePricing[];
}

export interface FinalizeQuotationRequest {
  /** Optional when mixDistributorByItemId is provided. */
  distributorCompanyId?: string;
  /** Inquiry item id → source distributor company id for mix cost basis. */
  mixDistributorByItemId?: Record<string, string>;
  linePricing: AdminInquiryLinePricing[];
  message?: string;
}
