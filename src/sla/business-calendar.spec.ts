import { DateTime } from 'luxon';
import {
  BusinessCalendar,
  InvalidBusinessCalendarError,
  addBusinessMinutes,
  businessMinutesBetween,
} from './business-calendar';

const calendar: BusinessCalendar = {
  timezone: 'Europe/Belgrade',
  startHour: 9,
  endHour: 17,
  workdays: [1, 2, 3, 4, 5],
  holidays: [],
};

const at = (local: string): Date => DateTime.fromISO(local, { zone: calendar.timezone }).toJSDate();

describe('addBusinessMinutes', () => {
  it('adds minutes inside a single working day', () => {
    expect(addBusinessMinutes(at('2026-03-04T10:00'), 120, calendar)).toEqual(
      at('2026-03-04T12:00'),
    );
  });

  it('lands exactly on the end of the window when the day is fully consumed', () => {
    expect(addBusinessMinutes(at('2026-03-04T09:00'), 480, calendar)).toEqual(
      at('2026-03-04T17:00'),
    );
  });

  it('rolls the remainder onto the next working day', () => {
    expect(addBusinessMinutes(at('2026-03-04T10:00'), 480, calendar)).toEqual(
      at('2026-03-05T10:00'),
    );
  });

  it('starts counting at opening time when raised before business hours', () => {
    expect(addBusinessMinutes(at('2026-03-04T07:00'), 60, calendar)).toEqual(
      at('2026-03-04T10:00'),
    );
  });

  it('defers to the next morning when raised after closing time', () => {
    expect(addBusinessMinutes(at('2026-03-04T18:30'), 60, calendar)).toEqual(
      at('2026-03-05T10:00'),
    );
  });

  it('skips the weekend', () => {
    expect(addBusinessMinutes(at('2026-03-07T12:00'), 30, calendar)).toEqual(
      at('2026-03-09T09:30'),
    );
  });

  it('carries a multi-day budget across a weekend', () => {
    expect(addBusinessMinutes(at('2026-03-06T16:00'), 180, calendar)).toEqual(
      at('2026-03-09T11:00'),
    );
  });

  it('skips configured holidays', () => {
    const withHoliday: BusinessCalendar = { ...calendar, holidays: ['2026-03-05'] };
    expect(addBusinessMinutes(at('2026-03-04T16:00'), 120, withHoliday)).toEqual(
      at('2026-03-06T10:00'),
    );
  });

  it('normalises a zero-minute budget to the next working instant', () => {
    expect(addBusinessMinutes(at('2026-03-07T12:00'), 0, calendar)).toEqual(at('2026-03-09T09:00'));
  });

  it('stays correct across a daylight-saving transition', () => {
    expect(addBusinessMinutes(at('2026-03-27T16:00'), 120, calendar)).toEqual(
      at('2026-03-30T10:00'),
    );
  });

  it('supports a 24-hour window', () => {
    const roundTheClock: BusinessCalendar = { ...calendar, startHour: 0, endHour: 24 };
    expect(addBusinessMinutes(at('2026-03-04T23:00'), 120, roundTheClock)).toEqual(
      at('2026-03-05T01:00'),
    );
  });

  it('rejects a negative budget', () => {
    expect(() => addBusinessMinutes(at('2026-03-04T10:00'), -1, calendar)).toThrow(RangeError);
  });
});

describe('businessMinutesBetween', () => {
  it('returns zero when the range is inverted', () => {
    expect(businessMinutesBetween(at('2026-03-04T12:00'), at('2026-03-04T10:00'), calendar)).toBe(
      0,
    );
  });

  it('counts only the overlap with the working window', () => {
    expect(businessMinutesBetween(at('2026-03-04T07:00'), at('2026-03-04T23:00'), calendar)).toBe(
      480,
    );
  });

  it('ignores whole non-working days', () => {
    expect(businessMinutesBetween(at('2026-03-06T16:00'), at('2026-03-09T10:00'), calendar)).toBe(
      120,
    );
  });

  it('counts nothing for a range fully inside a weekend', () => {
    expect(businessMinutesBetween(at('2026-03-07T09:00'), at('2026-03-08T17:00'), calendar)).toBe(
      0,
    );
  });

  it('stays correct across a daylight-saving transition', () => {
    expect(businessMinutesBetween(at('2026-03-27T16:00'), at('2026-03-30T10:00'), calendar)).toBe(
      120,
    );
  });
});

describe('assertValidCalendar', () => {
  it.each([
    ['unknown timezone', { ...calendar, timezone: 'Mars/Olympus' }],
    ['closing before opening', { ...calendar, endHour: 9 }],
    ['no workdays', { ...calendar, workdays: [] }],
    ['weekday out of range', { ...calendar, workdays: [0] }],
    ['malformed holiday', { ...calendar, holidays: ['05.03.2026'] }],
  ])('rejects a calendar with %s', (_label, broken) => {
    expect(() =>
      addBusinessMinutes(at('2026-03-04T10:00'), 60, broken as BusinessCalendar),
    ).toThrow(InvalidBusinessCalendarError);
  });
});
