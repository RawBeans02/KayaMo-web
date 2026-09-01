/**
 * Same rule as `kayamo_logical_date` in Postgres: shift local time back by
 * day_starts_at, then take the calendar date in the user's timezone.
 */
export function logicalDateFromInstant(
  instantIso: string,
  timeZone = 'Asia/Manila',
  dayStartsAt = '00:00:00',
): string {
  const instant = new Date(instantIso);
  const local = localParts(instant, timeZone);
  const [startHour, startMinute, startSecond] = parseDayStartsAt(dayStartsAt);
  const localMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  const shifted = localMs - ((startHour * 60 + startMinute) * 60 + startSecond) * 1000;
  const shiftedDate = new Date(shifted);
  return `${shiftedDate.getUTCFullYear()}-${pad(shiftedDate.getUTCMonth() + 1)}-${pad(shiftedDate.getUTCDate())}`;
}

export function localHourFromInstant(instantIso: string, timeZone = 'Asia/Manila'): number {
  return localParts(new Date(instantIso), timeZone).hour;
}

export function addLogicalCalendarDays(logicalDate: string, days: number): string {
  const [year, month, day] = parseLogicalDate(logicalDate);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return formatLogicalDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** Calendar months with end-of-month clamp (31 Jan + 1 month → 28/29 Feb). */
export function addLogicalCalendarMonths(logicalDate: string, months: number): string {
  const [year, month, day] = parseLogicalDate(logicalDate);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return formatLogicalDate(targetYear, normalizedMonth + 1, Math.min(day, lastDay));
}

/**
 * An instant that still maps to `logicalDate` after the day-boundary rule.
 * Used when the user is writing onto a selected day that is not "now".
 */
export function instantOnLogicalDate(
  logicalDate: string,
  timeZone = 'Asia/Manila',
  dayStartsAt = '00:00:00',
): string {
  const [year, month, day] = logicalDate.split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid logical date: ${logicalDate}`);
  const searchStart = Date.UTC(year, month - 1, day - 2, 0, 0, 0);
  let firstHit: string | null = null;
  for (let hour = 0; hour < 96; hour += 1) {
    const iso = new Date(searchStart + hour * 3_600_000).toISOString();
    if (logicalDateFromInstant(iso, timeZone, dayStartsAt) !== logicalDate) continue;
    firstHit ??= iso;
    const midday = new Date(Date.parse(iso) + 12 * 3_600_000).toISOString();
    if (logicalDateFromInstant(midday, timeZone, dayStartsAt) === logicalDate) return midday;
  }
  if (firstHit) return firstHit;
  throw new Error(`Could not place an instant on ${logicalDate}`);
}

function parseDayStartsAt(value: string): [number, number, number] {
  const [h = '0', m = '0', s = '0'] = value.split(':');
  return [Number(h), Number(m), Number(s)];
}

function parseLogicalDate(logicalDate: string): [number, number, number] {
  const [year, month, day] = logicalDate.split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid logical date: ${logicalDate}`);
  return [year, month, day];
}

function formatLogicalDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localParts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag = Object.fromEntries(
    fmt.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}
