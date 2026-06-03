export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  userId: string;
  email: string;
  role: string;
  companyId: number;
  companyName: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  companyId: number;
  companyName: string;
}
