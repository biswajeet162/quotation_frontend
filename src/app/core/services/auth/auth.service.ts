import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { STORAGE_KEYS } from '../../constants/storage.constants';
import { AuthResponse, AuthUser, ForgotPasswordRequest, LoginRequest, MessageResponse, ResetPasswordRequest, SignUpRequest, SignUpResponse } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly currentUserSignal = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly currentUser = this.currentUserSignal.asReadonly();

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => this.applyAuthResponse(response)),
    );
  }

  signUp(request: SignUpRequest): Observable<SignUpResponse> {
    return this.http.post<SignUpResponse>(`${environment.apiUrl}/auth/signup`, request);
  }

  verifyEmail(token: string): Observable<AuthResponse> {
    return this.http
      .get<AuthResponse>(`${environment.apiUrl}/auth/verify-email`, { params: { token } })
      .pipe(tap((response) => this.applyAuthResponse(response)));
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.apiUrl}/auth/reset-password`, request);
  }

  applyAuthResponse(response: AuthResponse): void {
    this.persistSession(response);
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    this.currentUserSignal.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.token);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private persistSession(response: AuthResponse): void {
    const user: AuthUser = {
      userId: response.userId,
      email: response.email,
      role: response.role,
      companyId: response.companyId,
      companyName: response.companyName,
    };

    localStorage.setItem(STORAGE_KEYS.token, response.token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    this.currentUserSignal.set(user);
  }

  private loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
