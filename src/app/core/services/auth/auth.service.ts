import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { STORAGE_KEYS } from '../../constants/storage.constants';
import { AuthResponse, AuthUser, LoginRequest } from '../../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly currentUserSignal = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly currentUser = this.currentUserSignal.asReadonly();

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => this.persistSession(response)),
    );
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    this.currentUserSignal.set(null);
    void this.router.navigate(['/login']);
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
