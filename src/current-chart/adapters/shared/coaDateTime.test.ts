import { formatCoaDateTime, parseCoaDateTime } from './coaDateTime';

describe('parseCoaDateTime', () => {
  it('parses dd-mm-yy HH:mm:ss as IST', () => {
    // 20-09-2026 16:13:30 IST = 20-09-2026 10:43:30 UTC
    expect(parseCoaDateTime('20-09-26 16:13:30')).toBe(Date.UTC(2026, 8, 20, 10, 43, 30));
  });

  it('parses times without seconds', () => {
    expect(parseCoaDateTime('16-09-23 14:47')).toBe(Date.UTC(2023, 8, 16, 9, 17, 0));
  });

  it('accepts a four-digit year', () => {
    expect(parseCoaDateTime('20-09-2026 16:13:30')).toBe(parseCoaDateTime('20-09-26 16:13:30'));
  });

  it('handles IST midnight crossing back into the previous UTC day', () => {
    expect(parseCoaDateTime('21-09-26 00:10:00')).toBe(Date.UTC(2026, 8, 20, 18, 40, 0));
  });

  it.each([
    null,
    undefined,
    '',
    'None',
    '2026-09-20 10:00',
    '31-02-26 10:00',
    '20-13-26 10:00',
    '20-09-26 24:00',
  ])('returns undefined for %j', (value) => {
    expect(parseCoaDateTime(value)).toBeUndefined();
  });
});

describe('formatCoaDateTime', () => {
  it('round-trips with parseCoaDateTime', () => {
    const ms = parseCoaDateTime('05-01-26 07:04:09') ?? Number.NaN;
    expect(formatCoaDateTime(ms)).toBe('05-01-2026 07:04:09');
  });
});
