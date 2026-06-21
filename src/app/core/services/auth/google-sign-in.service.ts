import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
  private scriptLoaded = false;
  private loadPromise: Promise<void> | null = null;

  isConfigured(): boolean {
    return !!environment.googleClientId?.trim();
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

  async renderSignUpButton(
    container: HTMLElement,
    onCredential: (credential: string) => void,
  ): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    await this.loadScript();

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response) => onCredential(response.credential),
    });

    container.innerHTML = '';
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signup_with',
      width: Math.min(container.offsetWidth || 360, 400),
    });
  }
}
