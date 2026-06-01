export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  userId: number;
  email: string;
  role: string;
  companyId: number;
  companyName: string;
}

export interface AuthUser {
  userId: number;
  email: string;
  role: string;
  companyId: number;
  companyName: string;
}
