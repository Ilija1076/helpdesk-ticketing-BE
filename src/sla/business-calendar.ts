import { DateTime } from 'luxon';

export interface BusinessCalendar {
  timezone: string;
  startHour: number;
  endHour: number;
  workdays: number[];
  holidays: string[];
}

export class InvalidBusinessCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBusinessCalendarError';
  }
}

const MAX_DAY_ITERATIONS = 3660;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidCalendar(calendar: BusinessCalendar): void {
  if (!DateTime.now().setZone(calendar.timezone).isValid) {
    throw new InvalidBusinessCalendarError(`Unknown IANA timezone: ${calendar.timezone}`);
  }
  if (!Number.isInteger(calendar.startHour) || calendar.startHour < 0 || calendar.startHour > 23) {
    throw new InvalidBusinessCalendarError(`startHour must be an integer in 0..23`);
  }
  if (!Number.isInteger(calendar.endHour) || calendar.endHour < 1 || calendar.endHour > 24) {
    throw new InvalidBusinessCalendarError(`endHour must be an integer in 1..24`);
  }
  if (calendar.endHour <= calendar.startHour) {
    throw new InvalidBusinessCalendarError(`endHour must be greater than startHour`);
  }
  if (calendar.workdays.length === 0) {
    throw new InvalidBusinessCalendarError(`workdays must contain at least one ISO weekday`);
  }
  if (calendar.workdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new InvalidBusinessCalendarError(`workdays must be ISO weekday numbers in 1..7`);
  }
  const badHoliday = calendar.holidays.find((date) => !ISO_DATE.test(date));
  if (badHoliday) {
    throw new InvalidBusinessCalendarError(`holidays must be YYYY-MM-DD, received: ${badHoliday}`);
  }
}

function isWorkingDay(day: DateTime, calendar: BusinessCalendar): boolean {
  if (!calendar.workdays.includes(day.weekday)) {
    return false;
  }
  return !calendar.holidays.includes(day.toISODate() ?? '');
}

function windowFor(day: DateTime, calendar: BusinessCalendar): { start: DateTime; end: DateTime } {
  const midnight = day.startOf('day');
  const start = midnight.set({
    hour: calendar.startHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const end =
    calendar.endHour === 24
      ? midnight.plus({ days: 1 }).startOf('day')
      : midnight.set({ hour: calendar.endHour, minute: 0, second: 0, millisecond: 0 });
  return { start, end };
}

function nextWorkingInstant(from: DateTime, calendar: BusinessCalendar): DateTime {
  let cursor = from;
  for (let iteration = 0; iteration <= MAX_DAY_ITERATIONS; iteration += 1) {
    if (isWorkingDay(cursor, calendar)) {
      const { start, end } = windowFor(cursor, calendar);
      if (cursor < start) {
        return start;
      }
      if (cursor < end) {
        return cursor;
      }
    }
    cursor = cursor.plus({ days: 1 }).startOf('day');
  }
  throw new InvalidBusinessCalendarError(
    `No working day found within ${MAX_DAY_ITERATIONS} days of ${from.toISO()}`,
  );
}

export function addBusinessMillis(from: Date, millis: number, calendar: BusinessCalendar): Date {
  assertValidCalendar(calendar);
  if (!Number.isFinite(millis) || millis < 0) {
    throw new RangeError(`millis must be a non-negative finite number, received: ${millis}`);
  }

  let cursor = nextWorkingInstant(DateTime.fromJSDate(from, { zone: calendar.timezone }), calendar);
  let remaining = millis;

  for (let iteration = 0; iteration <= MAX_DAY_ITERATIONS; iteration += 1) {
    const { end } = windowFor(cursor, calendar);
    const available = end.diff(cursor).toMillis();

    if (remaining <= available) {
      return cursor.plus({ milliseconds: remaining }).toJSDate();
    }

    remaining -= available;
    cursor = nextWorkingInstant(cursor.plus({ days: 1 }).startOf('day'), calendar);
  }

  throw new RangeError(`Deadline exceeds ${MAX_DAY_ITERATIONS} business days`);
}

export function addBusinessMinutes(from: Date, minutes: number, calendar: BusinessCalendar): Date {
  return addBusinessMillis(from, minutes * 60_000, calendar);
}

export function businessMillisBetween(from: Date, to: Date, calendar: BusinessCalendar): number {
  assertValidCalendar(calendar);

  const start = DateTime.fromJSDate(from, { zone: calendar.timezone });
  const end = DateTime.fromJSDate(to, { zone: calendar.timezone });
  if (end <= start) {
    return 0;
  }

  let total = 0;
  let day = start.startOf('day');

  for (let iteration = 0; day < end; iteration += 1) {
    if (iteration > MAX_DAY_ITERATIONS) {
      throw new RangeError(`Range exceeds ${MAX_DAY_ITERATIONS} days`);
    }
    if (isWorkingDay(day, calendar)) {
      const { start: windowStart, end: windowEnd } = windowFor(day, calendar);
      const overlapStart = windowStart > start ? windowStart : start;
      const overlapEnd = windowEnd < end ? windowEnd : end;
      if (overlapEnd > overlapStart) {
        total += overlapEnd.diff(overlapStart).toMillis();
      }
    }
    day = day.plus({ days: 1 }).startOf('day');
  }

  return total;
}

export function businessMinutesBetween(from: Date, to: Date, calendar: BusinessCalendar): number {
  return businessMillisBetween(from, to, calendar) / 60_000;
}
