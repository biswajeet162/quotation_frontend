export interface SpecificationEntry {
  key: string;
  value: string;
}

/** Parse stored specifications (JSON object or plain text) into key/value rows. */
export function parseSpecifications(raw: string | undefined): SpecificationEntry[] {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          key: String(index + 1),
          value: formatSpecValue(item),
        }));
      }
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
          key,
          value: formatSpecValue(value),
        }));
      }
    } catch {
      // fall through to plain text
    }
  }

  return [{ key: '', value: trimmed }];
}

/** Single-line label for inputs, autocomplete, and table cells. */
export function formatSpecificationsInline(raw: string | undefined): string {
  const entries = parseSpecifications(raw);
  if (entries.length === 0) {
    return '';
  }
  return entries
    .map((entry) => (entry.key ? `${entry.key}: ${entry.value}` : entry.value))
    .join(', ');
}

/** Labels used in autocomplete (one entry per key/value). */
export function specificationSuggestionLabels(raw: string | undefined): string[] {
  const entries = parseSpecifications(raw);
  return entries
    .map((entry) => (entry.key ? `${entry.key}: ${entry.value}` : entry.value))
    .filter((label) => label.length > 0);
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
