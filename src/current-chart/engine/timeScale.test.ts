import { MS_PER_MINUTE } from '../domain';
import { panTimeScale, timeToX, xToTime, zoomTimeScale, type TimeScale } from './timeScale';

const T0 = Date.UTC(2026, 8, 21, 0, 0, 0);
const scale: TimeScale = { start: T0, pxPerMinute: 4 };

describe('timeScale', () => {
  it('maps the start to x = 0 and scales linearly', () => {
    expect(timeToX(scale, T0)).toBe(0);
    expect(timeToX(scale, T0 + 10 * MS_PER_MINUTE)).toBe(40);
    expect(timeToX(scale, T0 - 5 * MS_PER_MINUTE)).toBe(-20);
  });

  it('keeps seconds (sub-minute precision)', () => {
    expect(timeToX(scale, T0 + 30_000)).toBe(2);
  });

  it('round-trips x → time → x', () => {
    for (const x of [-100, 0, 0.5, 123.4, 880]) {
      expect(timeToX(scale, xToTime(scale, x))).toBeCloseTo(x, 9);
    }
  });

  it('zooms about an anchor, keeping its time fixed', () => {
    const anchorTime = xToTime(scale, 200);
    const zoomed = zoomTimeScale(scale, 2.5, 200);
    expect(zoomed.pxPerMinute).toBe(10);
    expect(xToTime(zoomed, 200)).toBeCloseTo(anchorTime, 3);
  });

  it('pans: dragging right brings earlier times into view', () => {
    const panned = panTimeScale(scale, 40);
    expect(panned.start).toBe(T0 - 10 * MS_PER_MINUTE);
    expect(panned.pxPerMinute).toBe(4);
  });
});
