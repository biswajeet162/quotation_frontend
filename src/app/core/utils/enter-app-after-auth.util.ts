import { Router } from '@angular/router';
import { STORAGE_KEYS } from '../constants/storage.constants';

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

/** True when the browser should use Flutter Web under `/m/`. */
export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return MOBILE_UA.test(navigator.userAgent || '');
}

/**
 * Flutter SharedPreferences on web stores under `flutter.` + key, with JSON-encoded values.
 * Angular uses bare keys — copy so /m/ picks up the session after invite accept.
 */
function syncSessionToFlutterWebStorage(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const user = localStorage.getItem(STORAGE_KEYS.user);
  if (token) {
    localStorage.setItem(`flutter.${STORAGE_KEYS.token}`, JSON.stringify(token));
  }
  if (user) {
    localStorage.setItem(`flutter.${STORAGE_KEYS.user}`, JSON.stringify(user));
  }
}

/**
 * After invite accept / auth on an Angular public page:
 * - Phone → full navigation into Flutter `/m/…` (middleware never runs on SPA navigates)
 * - Laptop → normal Angular router
 */
export function enterAppAfterAuth(router: Router, path: string): void {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (isMobileBrowser() && typeof window !== 'undefined') {
    syncSessionToFlutterWebStorage();
    window.location.assign(`/m${normalized}`);
    return;
  }
  void router.navigateByUrl(normalized);
}
