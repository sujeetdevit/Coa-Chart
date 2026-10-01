import type { TrainGeometry } from './CurrentChartEngine';
import type { Point } from './types';

export type HitTarget =
  | { kind: 'vertex'; trainId: string; pointIndex: number; distance: number }
  | { kind: 'segment'; trainId: string; segmentIndex: number; distance: number };

export interface HitTolerance {
  vertexPx: number;
  segmentPx: number;
}

interface Entry {
  trainId: string;
  /** Segment from points[index] to points[index + 1]; for vertices the point index. */
  index: number;
  a: Point;
  b: Point;
}

/**
 * Uniform-grid spatial index over train paths in plot coordinates. Built once per viewport;
 * queries look only at the cells around the pointer. Vertices win over segments when both
 * are within tolerance, so points and labels anchored on them are easy to hover.
 */
export class TrainHitIndex {
  private readonly cells = new Map<string, Entry[]>();
  private readonly vertices = new Map<string, Entry[]>();

  constructor(
    geometries: readonly TrainGeometry[],
    private readonly cellSize = 32,
  ) {
    for (const g of geometries) {
      g.points.forEach((p, i) => {
        this.insert(this.vertices, { trainId: g.trainId, index: i, a: p, b: p });
        const next = g.points[i + 1];
        if (next) this.insert(this.cells, { trainId: g.trainId, index: i, a: p, b: next });
      });
    }
  }

  hitTest(point: Point, tolerance: HitTolerance): HitTarget | undefined {
    let best: HitTarget | undefined;
    for (const e of this.candidates(this.vertices, point, tolerance.vertexPx)) {
      const d = Math.hypot(point.x - e.a.x, point.y - e.a.y);
      if (d <= tolerance.vertexPx && (!best || d < best.distance)) {
        best = { kind: 'vertex', trainId: e.trainId, pointIndex: e.index, distance: d };
      }
    }
    if (best) return best;
    for (const e of this.candidates(this.cells, point, tolerance.segmentPx)) {
      const d = distanceToSegment(point, e.a, e.b);
      if (d <= tolerance.segmentPx && (!best || d < best.distance)) {
        best = { kind: 'segment', trainId: e.trainId, segmentIndex: e.index, distance: d };
      }
    }
    return best;
  }

  private insert(map: Map<string, Entry[]>, entry: Entry): void {
    const s = this.cellSize;
    const x0 = Math.floor(Math.min(entry.a.x, entry.b.x) / s);
    const x1 = Math.floor(Math.max(entry.a.x, entry.b.x) / s);
    const y0 = Math.floor(Math.min(entry.a.y, entry.b.y) / s);
    const y1 = Math.floor(Math.max(entry.a.y, entry.b.y) / s);
    // Long segments (e.g. a train standing for hours) span many cells; cap the work per segment.
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) {
      this.add(map, 'big', entry);
      return;
    }
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) this.add(map, `${cx},${cy}`, entry);
  }

  private add(map: Map<string, Entry[]>, key: string, entry: Entry): void {
    const list = map.get(key);
    if (list) list.push(entry);
    else map.set(key, [entry]);
  }

  private *candidates(map: Map<string, Entry[]>, p: Point, radius: number): Generator<Entry> {
    const s = this.cellSize;
    const seen = new Set<Entry>();
    for (let cx = Math.floor((p.x - radius) / s); cx <= Math.floor((p.x + radius) / s); cx++) {
      for (let cy = Math.floor((p.y - radius) / s); cy <= Math.floor((p.y + radius) / s); cy++) {
        for (const e of map.get(`${cx},${cy}`) ?? []) {
          if (!seen.has(e)) {
            seen.add(e);
            yield e;
          }
        }
      }
    }
    yield* map.get('big') ?? [];
  }
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
