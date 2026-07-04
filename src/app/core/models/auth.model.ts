export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SignUpResponse {
  message: string;
  email: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface MessageResponse {
  message: string;
}

export interface GoogleSignUpRequest {
  idToken: string;
  companyName?: string;
  phone?: string;
}

export interface GoogleConfigResponse {
  clientId: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  userId: string;
  email: string;
  role: string;
  companyId?: string | null;
  companyName?: string | null;
  needsCompanySetup?: boolean;
  message?: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  companyId?: string | null;
  companyName?: string | null;
  needsCompanySetup?: boolean;
}
