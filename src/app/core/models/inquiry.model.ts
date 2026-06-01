export type InquiryStatus =
  | 'NEW'
  | 'SENT_TO_DISTRIBUTORS'
  | 'RESPONSES_RECEIVED'
  | 'FINAL_SENT'
  | 'CLOSED';

export type InquiryRequestSource = 'CATALOG_SEARCH' | 'NEW_PRODUCT_SEARCH' | 'MIXED';

export type InquiryLineSource = 'CATALOG_MATCH' | 'NEW_PRODUCT';

export interface InquiryItem {
  id?: number;
  productId: number;
  productBrand?: string;
  productName?: string;
  quantity: number;
  notes?: string;
  lineSource?: InquiryLineSource;
}

export interface Inquiry {
  id: number;
  inquiryId: string;
  companyId: number;
  companyName?: string;
  title: string;
  description?: string;
  status: InquiryStatus;
  needsClarification?: boolean;
  clarificationMessage?: string;
  requestSource?: InquiryRequestSource;
  searchTerm?: string;
  items?: InquiryItem[];
  distributors?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateInquiryRequest {
  title: string;
  description?: string;
  searchTerm?: string;
  items: {
    productId: number;
    quantity: number;
    notes?: string;
    lineSource?: InquiryLineSource;
  }[];
}

export interface FindOrCreateProductRequest {
  brand: string;
  designation: string;
  groupName?: string;
  category?: string;
  description?: string;
  specifications?: string;
  aliasNames?: string;
}

export interface QuoteCartLine {
  productId: number;
  brand: string;
  designation: string;
  category?: string;
  quantity: number;
  lineNotes: string;
  lineSource: InquiryLineSource;
}
