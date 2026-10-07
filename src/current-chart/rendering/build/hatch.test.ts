import { hatchSegments, type HatchRect } from './hatch';

const rect: HatchRect = { x0: 100, y0: 50, x1: 200, y1: 80 };

/** Segments as [x1, y1, x2, y2] rows. */
function rows(points: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < points.length; i += 4) out.push(points.slice(i, i + 4));
  return out;
}

const slope = ([xa, ya, xb, yb]: number[]) => ((yb ?? 0) - (ya ?? 0)) / ((xb ?? 0) - (xa ?? 0));

describe('hatchSegments', () => {
  it('draws UP blocks with lines rising to the right', () => {
    const lines = rows(hatchSegments(rect, 'UP', 8));
    expect(lines.length).toBeGreaterThan(5);
    // Screen y grows downwards, so "rising" is a slope of −1.
    for (const line of lines) expect(slope(line)).toBeCloseTo(-1, 9);
  });

  it('draws DN blocks with lines falling to the right', () => {
    const lines = rows(hatchSegments(rect, 'DN', 8));
    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) expect(slope(line)).toBeCloseTo(1, 9);
  });

  it('crosses both sets for blocks on both lines', () => {
    const up = hatchSegments(rect, 'UP', 8);
    const down = hatchSegments(rect, 'DN', 8);
    expect(hatchSegments(rect, 'BOTH', 8)).toEqual([...up, ...down]);
  });

  it('keeps every line inside the rectangle', () => {
    for (const [xa, ya, xb, yb] of rows(hatchSegments(rect, 'BOTH', 8))) {
      for (const x of [xa, xb]) {
        expect(x).toBeGreaterThanOrEqual(rect.x0 - 1e-9);
        expect(x).toBeLessThanOrEqual(rect.x1 + 1e-9);
      }
      for (const y of [ya, yb]) {
        expect(y).toBeGreaterThanOrEqual(rect.y0 - 1e-9);
        expect(y).toBeLessThanOrEqual(rect.y1 + 1e-9);
      }
    }
  });

  it('spaces the lines by the given distance, measured across them', () => {
    const lines = rows(hatchSegments({ x0: 0, y0: 0, x1: 400, y1: 100 }, 'DN', 10));
    // Neighbouring 45° lines 10 px apart cross a horizontal line 10·√2 px apart.
    const crossings = lines
      .filter(([, ya]) => ya === 0)
      .map(([xa]) => xa ?? 0)
      .sort((a, b) => a - b);
    expect(crossings.length).toBeGreaterThan(3);
    for (let i = 1; i < crossings.length; i++) {
      expect((crossings[i] ?? 0) - (crossings[i - 1] ?? 0)).toBeCloseTo(10 * Math.SQRT2, 9);
    }
  });

  it('hatches only the visible part, with the same lines as the whole rectangle there', () => {
    const long: HatchRect = { x0: -5000, y0: 50, x1: 5000, y1: 80 };
    const visible: HatchRect = { x0: 0, y0: 0, x1: 300, y1: 200 };
    const clipped = rows(hatchSegments(long, 'UP', 8, visible));
    const whole = rows(hatchSegments(long, 'UP', 8));

    expect(clipped.length).toBeLessThan(40);
    expect(whole.length).toBeGreaterThan(800);
    for (const [xa, , xb] of clipped) {
      expect(xa).toBeGreaterThanOrEqual(0);
      expect(xb).toBeLessThanOrEqual(300);
    }
    // A line fully inside the visible part is identical in both.
    const inside = clipped.find(([xa, , xb]) => (xa ?? 0) > 50 && (xb ?? 0) < 250);
    expect(inside).toBeDefined();
    expect(whole).toContainEqual(inside);
  });

  it('moves the pattern with the rectangle', () => {
    const moved = { x0: rect.x0 + 37, y0: rect.y0, x1: rect.x1 + 37, y1: rect.y1 };
    const shifted = hatchSegments(rect, 'BOTH', 8).map((v, i) => (i % 2 === 0 ? v + 37 : v));
    hatchSegments(moved, 'BOTH', 8).forEach((v, i) => {
      expect(v).toBeCloseTo(shifted[i] ?? NaN, 9);
    });
  });

  it('draws nothing for an empty or off-screen rectangle', () => {
    expect(hatchSegments({ x0: 10, y0: 10, x1: 10, y1: 40 }, 'UP', 8)).toEqual([]);
    expect(hatchSegments(rect, 'UP', 8, { x0: 500, y0: 0, x1: 900, y1: 900 })).toEqual([]);
    expect(hatchSegments(rect, 'UP', 0)).toEqual([]);
  });
});
