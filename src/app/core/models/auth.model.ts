export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
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
  companyId: string;
  companyName: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  companyId: string;
  companyName: string;
}
