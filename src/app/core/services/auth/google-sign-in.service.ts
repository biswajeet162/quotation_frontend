import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type GoogleButtonMode = 'signup' | 'signin';

@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  private readonly http = inject(HttpClient);

  private scriptLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private resolvedClientId: string | null = null;
  private configPromise: Promise<string | null> | null = null;

  isConfigured(): boolean {
    return !!environment.googleClientId?.trim();
  }

  async getClientId(): Promise<string | null> {
    if (this.resolvedClientId) {
      return this.resolvedClientId;
    }

    if (!this.configPromise) {
      this.configPromise = this.resolveClientId();
    }

    return this.configPromise;
  }

  loadScript(): Promise<void> {
    if (this.scriptLoaded) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        this.scriptLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  async renderButton(
    container: HTMLElement,
    mode: GoogleButtonMode,
    onCredential: (credential: string) => void,
  ): Promise<boolean> {
    const clientId = await this.getClientId();
    if (!clientId) {
      return false;
    }

    await this.loadScript();

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
    });

    container.innerHTML = '';
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
      width: Math.min(container.offsetWidth || 360, 400),
    });

    return true;
  }

  private async resolveClientId(): Promise<string | null> {
    const fromEnv = environment.googleClientId?.trim();
    if (fromEnv) {
      this.resolvedClientId = fromEnv;
      return fromEnv;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<{ clientId: string }>(`${environment.apiUrl}/auth/google/config`),
      );
      const fromApi = response.clientId?.trim();
      if (fromApi) {
        this.resolvedClientId = fromApi;
        return fromApi;
      }
    } catch {
      // Backend may be unreachable during local UI work.
    }

    return null;
  }
}
