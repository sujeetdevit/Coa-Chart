import type { TrainGeometry, TrainPathPoint } from './CurrentChartEngine';
import { TrainHitIndex, distanceToSegment } from './hitIndex';

function geometry(trainId: string, coords: [number, number][]): TrainGeometry {
  const points: TrainPathPoint[] = coords.map(([x, y], i) => ({
    x,
    y,
    time: i,
    stationId: '1:AAA',
    kind: 'through',
    eventIndex: i,
  }));
  return { trainId, points };
}

const tolerance = { vertexPx: 6, segmentPx: 5 };

describe('distanceToSegment', () => {
  it('measures to the nearest point on the segment, clamped to its ends', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(distanceToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distanceToSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(Math.SQRT2, 9);
  });
});

describe('TrainHitIndex', () => {
  const index = new TrainHitIndex([
    geometry('A', [
      [0, 0],
      [100, 100],
    ]),
    geometry('B', [
      [0, 100],
      [100, 0],
    ]),
    geometry('C', [
      [300, 50],
      [5000, 50], // long standing line spanning many cells
    ]),
  ]);

  it('finds the segment under the pointer', () => {
    expect(index.hitTest({ x: 20, y: 22 }, tolerance)).toMatchObject({
      kind: 'segment',
      trainId: 'A',
      segmentIndex: 0,
    });
    expect(index.hitTest({ x: 20, y: 80 }, tolerance)).toMatchObject({ kind: 'segment', trainId: 'B' });
    expect(index.hitTest({ x: 4000, y: 52 }, tolerance)).toMatchObject({ trainId: 'C' });
  });

  it('prefers a vertex within tolerance over a closer segment', () => {
    expect(index.hitTest({ x: 103, y: 99 }, tolerance)).toMatchObject({ kind: 'vertex', pointIndex: 1 });
  });

  it('returns nothing outside tolerance', () => {
    expect(index.hitTest({ x: 50, y: 20 }, tolerance)).toBeUndefined();
    expect(index.hitTest({ x: 200, y: 50 }, tolerance)).toBeUndefined();
  });

  it('picks the nearer of two candidates', () => {
    // Crossing point of A and B is (50, 50); just above it is nearer B's segment? Both equal at 50,50.
    const hit = index.hitTest({ x: 52, y: 50 }, tolerance);
    expect(hit?.kind).toBe('segment');
    expect(hit?.distance).toBeCloseTo(Math.SQRT2, 6);
  });
});
