import { event, train } from '../../../tests/fixtures/smallModel';
import { MS_PER_MINUTE } from '../../domain';
import { eventsAfter, snapshotTime } from './asOf';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);
const min = (m: number) => T0 + m * MS_PER_MINUTE;

/** One train with a departure every `step` minutes from 0 to `until`. */
function steady(until: number, step: number) {
  const events = [];
  for (let m = 0, i = 0; m <= until; m += step, i++) events.push(event(i, 'AAA', { departure: min(m) }));
  return train('steady', events);
}

describe('snapshotTime', () => {
  const rule = { windowMinutes: 60, minEvents: 5 };

  it('is the last report when reporting is continuous', () => {
    expect(snapshotTime([steady(120, 5)], rule)).toBe(min(120));
  });

  it('ignores isolated late reports', () => {
    const straggler = train('late', [
      event(0, 'AAA', { arrival: min(300) }),
      event(1, 'BBB', { departure: min(420) }),
    ]);
    expect(snapshotTime([steady(120, 5), straggler], rule)).toBe(min(120));
    expect(eventsAfter([steady(120, 5), straggler], min(120))).toBe(2);
  });

  it('falls back to the latest report when reporting is sparse everywhere', () => {
    expect(snapshotTime([steady(600, 60)], rule)).toBe(min(600));
  });

  it('is undefined with no reports', () => {
    expect(snapshotTime([], rule)).toBeUndefined();
  });
});
