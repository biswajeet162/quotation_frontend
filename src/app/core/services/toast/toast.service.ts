import { Injectable, signal } from '@angular/core';
import {
  ApiMessageSeverity,
  extractApiErrorMessage,
  getApiErrorSeverity,
} from '../../utils/api-error.util';

export type ToastSeverity = ApiMessageSeverity;

export interface ToastMessage {
  id: number;
  severity: ToastSeverity;
  message: string;
  durationMs: number;
}

/**
 * Single place to tune toast behaviour for the whole app.
 * Change {@link TOAST_DURATION_MS} to adjust how long every toast stays visible.
 */
export const TOAST_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<ToastMessage[]>([]);
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = this._toasts.asReadonly();

  success(message: string, durationMs = TOAST_DURATION_MS): void {
    this.show('SUCCESS', message, durationMs);
  }

  warning(message: string, durationMs = TOAST_DURATION_MS): void {
    this.show('WARNING', message, durationMs);
  }

  error(message: string, durationMs = TOAST_DURATION_MS): void {
    this.show('ERROR', message, durationMs);
  }

  /** Show ERROR or WARNING from an API error response. */
  fromApiError(error: unknown, fallback: string): void {
    const message = extractApiErrorMessage(error, fallback);
    const severity = getApiErrorSeverity(error);
    if (severity === 'WARNING') {
      this.warning(message);
      return;
    }
    this.error(message);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(severity: ToastSeverity, message: string, durationMs: number): void {
    const trimmed = message?.trim();
    if (!trimmed) {
      return;
    }

    const id = this.nextId++;
    const toast: ToastMessage = { id, severity, message: trimmed, durationMs };
    this._toasts.update((list) => [...list.slice(-4), toast]);

    if (durationMs > 0) {
      const timer = setTimeout(() => this.dismiss(id), durationMs);
      this.timers.set(id, timer);
    }
  }
}
