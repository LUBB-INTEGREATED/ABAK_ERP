export type WeekStart = 'sunday' | 'monday';

export interface WorkingDayOptions {
  weekStart?: WeekStart;
  holidays?: Set<string>; // ISO YYYY-MM-DD
}

function dateKey(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekendDays(weekStart: WeekStart): number[] {
  // JS: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  // Saudi work week (weekStart=sunday): work Sun-Thu, weekend Fri-Sat → [5, 6]
  // Western work week (weekStart=monday): work Mon-Fri, weekend Sat-Sun → [0, 6]
  return weekStart === 'sunday' ? [5, 6] : [0, 6];
}

export function isWorkingDay(
  date: Date,
  options: WorkingDayOptions = {},
): boolean {
  const { weekStart = 'sunday', holidays } = options;
  if (weekendDays(weekStart).includes(date.getUTCDay())) return false;
  if (holidays?.has(dateKey(date))) return false;
  return true;
}

export function addWorkingDays(
  from: Date,
  days: number,
  options: WorkingDayOptions = {},
): Date {
  if (days === 0) return new Date(from);
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  const cursor = new Date(from);
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    if (isWorkingDay(cursor, options)) remaining -= 1;
  }
  return cursor;
}

export function workingDaysBetween(
  from: Date,
  to: Date,
  options: WorkingDayOptions = {},
): number {
  if (from.getTime() === to.getTime()) return 0;
  const [start, end, sign] = from < to ? [from, to, 1] : [to, from, -1];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setUTCHours(0, 0, 0, 0);
  let count = 0;
  while (cursor < endDay) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isWorkingDay(cursor, options)) count += 1;
  }
  return count * sign;
}

export function buildHolidaySet(
  holidays: Array<{ date: Date | string }>,
): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    const d = typeof h.date === 'string' ? new Date(h.date) : h.date;
    set.add(dateKey(d));
  }
  return set;
}
