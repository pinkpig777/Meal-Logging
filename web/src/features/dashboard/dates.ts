import { formatMonthDay, parseLocalDate, toLocalDateString } from '@/lib/format';

/** "YYYY-MM-DD" + n days (local calendar). */
export function addDays(date: string, n: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
}

/** Monday of the week that contains `date` (weeks start on Monday). */
export function mondayOf(date: string): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalDateString(d);
}

/** "This week" only for the week that contains today; otherwise "Week of Oct 26". */
export function weekTitle(start: string | undefined, today: string): string {
  if (!start) return 'This week';
  const monday = mondayOf(start);
  if (monday <= today && today <= addDays(monday, 6)) return 'This week';
  return `Week of ${formatMonthDay(monday)}`;
}
