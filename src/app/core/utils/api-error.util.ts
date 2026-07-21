/**
 * Shared helpers for the backend ApiErrorResponse envelope.
 * Stage 2 toasters should use severity + message instead of ad-hoc err.error.message checks.
 */

export type ApiMessageSeverity = 'ERROR' | 'WARNING' | 'SUCCESS';

export interface ApiErrorDetails {
  fieldErrors?: Record<string, string>;
  missing?: string[];
  [key: string]: unknown;
}

export interface ApiErrorBody {
  timestamp?: string;
  status?: number;
  error?: string;
  code?: string;
  severity?: ApiMessageSeverity | string;
  message?: string | Record<string, string>;
  details?: ApiErrorDetails;
  path?: string;
  /** Legacy field used by older employee-contact responses */
  missing?: string[];
}

export function getApiErrorBody(error: unknown): ApiErrorBody | null {
  if (!error || typeof error !== 'object' || !('error' in error)) {
    return null;
  }
  const payload = (error as { error?: unknown }).error;
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as ApiErrorBody;
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const body = getApiErrorBody(error);
  if (!body) {
    if (typeof (error as { error?: unknown })?.error === 'string') {
      const raw = ((error as { error: string }).error || '').trim();
      if (raw) {
        return raw;
      }
    }
    return fallback;
  }

  const message = body.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  // Legacy: validation used to put field map in `message`
  if (message && typeof message === 'object') {
    const first = Object.values(message).find((v) => typeof v === 'string' && v.trim());
    if (typeof first === 'string') {
      return first;
    }
  }

  const fieldErrors = body.details?.fieldErrors;
  if (fieldErrors) {
    const first = Object.values(fieldErrors).find((v) => typeof v === 'string' && v.trim());
    if (typeof first === 'string') {
      return first;
    }
  }

  return fallback;
}

export function getApiErrorCode(error: unknown): string | null {
  const body = getApiErrorBody(error);
  return typeof body?.code === 'string' ? body.code : null;
}

export function getApiErrorSeverity(error: unknown): ApiMessageSeverity {
  const body = getApiErrorBody(error);
  const severity = body?.severity?.toUpperCase();
  if (severity === 'WARNING') {
    return 'WARNING';
  }
  if (severity === 'SUCCESS') {
    return 'SUCCESS';
  }
  return 'ERROR';
}

export function isApiErrorCode(error: unknown, code: string): boolean {
  return getApiErrorCode(error) === code;
}
