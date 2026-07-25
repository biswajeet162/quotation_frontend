/** Local calendar date as YYYY-MM-DD for HTML input[type=date] min/max attributes. */
export function todayAsDateInputValue(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** True when value is strictly before min (both YYYY-MM-DD). */
export function isDateInputBefore(value: string, min: string): boolean {
  const trimmedValue = value.trim();
  const trimmedMin = min.trim();
  if (!trimmedValue || !trimmedMin) {
    return false;
  }
  return trimmedValue < trimmedMin;
}

/** Latest YYYY-MM-DD from the given values (lexicographic max). */
export function maxDateInputValue(...values: (string | null | undefined)[]): string | undefined {
  let max: string | undefined;
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }
    if (!max || trimmed > max) {
      max = trimmed;
    }
  }
  return max;
}
