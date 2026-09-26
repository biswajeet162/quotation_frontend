export interface OnboardingBrandOption {
  name: string;
  group: string;
}

export interface OnboardingCategoryOption {
  id: string;
  title: string;
  summary: string;
}

export interface DistributorOnboardingOptions {
  brands: OnboardingBrandOption[];
  categories: OnboardingCategoryOption[];
}

export interface DistributorOnboardingStatus {
  completed: boolean;
}

export interface CompleteDistributorOnboardingRequest {
  brands: Array<{
    name: string;
    categories: string[];
  }>;
}
