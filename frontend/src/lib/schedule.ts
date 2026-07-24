// Client-side mirror of backend/apps/allowances/scheduling.py, used only to
// project a handful of *future* occurrences for the child's upcoming-events
// list beyond the single `next_run_at` cursor the API exposes. The backend
// remains the source of truth for what actually gets posted.

/** Smallest Date strictly after `after` on `weekday` (0=Mon..6=Sun) at `hour`:00 UTC --
 * `weekday`/`hour` are backend schedule fields evaluated against Django's
 * UTC `timezone.now()` (see backend/apps/allowances/scheduling.py), so this
 * must use UTC accessors rather than the browser's local timezone. */
export function nextWeeklyOccurrence(after: Date, weekday: number, hour: number): Date {
  const candidate = new Date(after);
  candidate.setUTCHours(hour, 0, 0, 0);
  const currentWeekday = (candidate.getUTCDay() + 6) % 7; // JS: 0=Sun..6=Sat -> 0=Mon..6=Sun
  const daysAhead = (weekday - currentWeekday + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  if (candidate.getTime() <= after.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return candidate;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Smallest Date strictly after `after` on `dayOfMonth` (clamped to short months) at `hour`:00 UTC. */
export function nextMonthlyOccurrence(after: Date, dayOfMonth: number, hour: number): Date {
  const build = (year: number, month: number) => {
    const day = Math.min(dayOfMonth, daysInMonth(year, month));
    const date = new Date(after);
    date.setUTCFullYear(year, month, day);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };

  let candidate = build(after.getUTCFullYear(), after.getUTCMonth());
  if (candidate.getTime() <= after.getTime()) {
    const nextMonth = after.getUTCMonth() + 1;
    candidate = nextMonth > 11 ? build(after.getUTCFullYear() + 1, 0) : build(after.getUTCFullYear(), nextMonth);
  }
  return candidate;
}

/** Projects `count` future occurrences starting from (and including) `nextRunAt`. */
export function projectOccurrences(
  nextRunAt: Date,
  count: number,
  step: (after: Date) => Date,
): Date[] {
  const occurrences: Date[] = [nextRunAt];
  let cursor = nextRunAt;
  while (occurrences.length < count) {
    // step() returns the smallest occurrence strictly after its argument, so
    // nudge forward past `cursor` itself (any offset short of the next
    // occurrence works; a day is safely less than the weekly/monthly period).
    cursor = step(new Date(cursor.getTime() + 24 * 60 * 60 * 1000));
    occurrences.push(cursor);
  }
  return occurrences;
}
