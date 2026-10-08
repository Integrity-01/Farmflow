export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  intervalCount: number;
  weekdays: number[]; // 0=Sun..6=Sat, weekly only
  dayOfMonth: number | null; // 1..31, monthly only
  startTimeMinutes: number; // minutes after local midnight
  startDate: Date; // date part only
  endDate: Date | null; // date part only, inclusive
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonthsClamped(date: Date, months: number, dayOfMonth: number): Date {
  const result = new Date(date);
  const monthIndex = result.getMonth() + months;
  const year = result.getFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(dayOfMonth, daysInMonth(year, month));
  result.setFullYear(year, month, day);
  return result;
}

function withStartTime(day: Date, minutes: number): Date {
  const result = new Date(day);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function pastEndDate(rule: RecurrenceRule, day: Date): boolean {
  if (!rule.endDate) return false;
  const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return candidate.getTime() > rule.endDate.getTime();
}

function nextWeekly(rule: RecurrenceRule, after: Date): Date | null {
  const cycleDays = rule.intervalCount * 7;
  const weekdays = new Set(rule.weekdays);

  let windowStart = new Date(rule.startDate);
  // Advance by whole cycles until the window containing `after`.
  let guard = 0;
  while (windowStart.getTime() <= after.getTime() && guard < 5200) {
    windowStart = addDays(windowStart, cycleDays);
    guard += 1;
  }

  // Find the first scheduled weekday strictly after `after`.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = addDays(windowStart, offset);
      if (weekdays.has(candidate.getDay()) && candidate.getTime() > after.getTime() && !pastEndDate(rule, candidate)) {
        return withStartTime(candidate, rule.startTimeMinutes);
      }
    }
    windowStart = addDays(windowStart, cycleDays);
  }
  return null;
}

function nextMonthly(rule: RecurrenceRule, after: Date): Date | null {
  const day = rule.dayOfMonth ?? rule.startDate.getDate();
  let candidate = addMonthsClamped(after, rule.intervalCount, day);
  let guard = 0;
  while (candidate.getTime() <= after.getTime() && guard < 24) {
    candidate = addMonthsClamped(candidate, rule.intervalCount, day);
    guard += 1;
  }
  if (pastEndDate(rule, candidate)) return null;
  return candidate;
}

/**
 * Returns the occurrence strictly after `after`, or null when the rule has
 * ended. All computations are in the server's local timezone, consistent with
 * how task timestamps are stored.
 */
export function nextOccurrence(rule: RecurrenceRule, after: Date): Date | null {
  switch (rule.frequency) {
    case 'daily': {
      const candidate = addDays(after, rule.intervalCount);
      if (pastEndDate(rule, candidate)) return null;
      return withStartTime(candidate, rule.startTimeMinutes);
    }
    case 'weekly':
      return nextWeekly(rule, after);
    case 'monthly':
      return nextMonthly(rule, after);
  }
}

/**
 * The first occurrence of a rule. Passed an "after" one day before the start
 * date so that the start date itself is eligible when it matches the pattern.
 */
export function firstOccurrence(rule: RecurrenceRule): Date | null {
  const anchor = addDays(rule.startDate, -1);
  return nextOccurrence(rule, anchor);
}