/** Formats a MySQL DATE/DATETIME value as a local `YYYY-MM-DD` string. */
export function formatDateOnly(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

/** Formats a MySQL DATETIME value as an ISO timestamp, preserving local time. */
export function formatDateTime(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Inclusive number of calendar days between two date-only values. */
export function daysInclusive(from: string | Date, to: string | Date): number {
  const start = toMidnight(from);
  const end = toMidnight(to);
  const diff = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(diff, 0);
}

function toMidnight(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}
