import { event, train } from '../../tests/fixtures/smallModel';
import { MS_PER_MINUTE } from '../domain';
import { computeDwellLanes, dwellLaneKey } from './dwellLanes';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);
const min = (m: number) => T0 + m * MS_PER_MINUTE;
const config = { minDwellMinutes: 2, laneOffsetPx: 3 };

describe('computeDwellLanes', () => {
  it('gives overlapping dwells at one station successive lanes; the first stays on the line', () => {
    const lanes = computeDwellLanes(
      [
        train('A', [event(1, 'BBB', { arrival: min(0), departure: min(30) })]),
        train('B', [event(1, 'BBB', { arrival: min(10), departure: min(20) })]),
        train('C', [event(1, 'BBB', { arrival: min(15), departure: min(40) })]),
      ],
      config,
    );
    expect(lanes.get(dwellLaneKey('A', 0))).toBeUndefined();
    expect(lanes.get(dwellLaneKey('B', 0))).toBe(1);
    expect(lanes.get(dwellLaneKey('C', 0))).toBe(2);
  });

  it('reuses a lane once it is free', () => {
    const lanes = computeDwellLanes(
      [
        train('A', [event(1, 'BBB', { arrival: min(0), departure: min(30) })]),
        train('B', [event(1, 'BBB', { arrival: min(5), departure: min(10) })]),
        train('C', [event(1, 'BBB', { arrival: min(12), departure: min(20) })]),
      ],
      config,
    );
    expect(lanes.get(dwellLaneKey('B', 0))).toBe(1);
    expect(lanes.get(dwellLaneKey('C', 0))).toBe(1);
  });

  it('ignores short dwells, through runs and other stations', () => {
    const lanes = computeDwellLanes(
      [
        train('A', [event(1, 'BBB', { arrival: min(0), departure: min(30) })]),
        train('B', [event(1, 'BBB', { arrival: min(5), departure: min(6) })]),
        train('C', [event(1, 'BBB', { arrival: min(7), departure: min(7) })]),
        train('D', [event(1, 'CCC', { arrival: min(5), departure: min(25) })]),
      ],
      config,
    );
    expect(lanes.size).toBe(0);
  });
});
