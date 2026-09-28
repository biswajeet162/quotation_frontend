/** App display timezone — all user-facing times use India Standard Time. */
export const APP_TIME_ZONE = 'Asia/Kolkata';

const APP_LOCALE = 'en-IN';

/**
 * Backend serializes LocalDateTime as zoneless ISO (Jackson/JVM UTC).
 * Treat strings without an offset as UTC so Kolkata conversion is correct.
 */
export function parseAppDate(iso?: string | null): Date | null {
  if (iso == null) {
    return null;
  }
  const trimmed = String(iso).trim();
  if (!trimmed) {
    return null;
  }

  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAppDateTime(
  iso?: string | null,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
): string {
  const date = parseAppDate(iso);
  if (!date) {
    return iso?.trim() ? String(iso).trim() : '—';
  }
  return date.toLocaleString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

export function formatAppDateOnly(
  iso?: string | null,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  },
): string {
  const date = parseAppDate(iso);
  if (!date) {
    return iso?.trim() ? String(iso).trim() : '—';
  }
  return date.toLocaleDateString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

export function formatAppChatTime(iso?: string | null): string {
  if (!iso?.trim()) {
    return '';
  }
  return formatAppDateTime(iso, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
