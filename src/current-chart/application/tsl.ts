import { stationId, type Board, type TslWorking } from '../domain';
import type { TrainPathPoint } from '../engine';

/**
 * Indices `i` of actual path segments (points[i] → points[i + 1]) run under TSL: both ends lie
 * between the TSL's from and to stations (inclusive) and the segment starts while the TSL is in
 * force. Manual legend: TSL movement is drawn as a purple dotted line.
 *
 * Interpretation: the manual shows the depiction but not the matching rule; this rule is ours.
 */
export function tslSegmentIndices(points: TrainPathPoint[], tsl: TslWorking[], board: Board): number[] {
  if (tsl.length === 0) return [];
  const order = new Map(board.stations.map((s) => [s.id, s.displayIndex]));
  const spans = tsl.flatMap((t) => {
    const a = order.get(stationId(t.sectionId, t.fromStationCode));
    const b = order.get(stationId(t.sectionId, t.toStationCode));
    return a === undefined || b === undefined
      ? []
      : [{ lo: Math.min(a, b), hi: Math.max(a, b), from: t.introducedAt, to: t.cancelledAt ?? Infinity }];
  });

  const result: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const p = points[i];
    const q = points[i + 1];
    if (!p || !q) continue;
    const pi = order.get(p.stationId);
    const qi = order.get(q.stationId);
    if (pi === undefined || qi === undefined || pi === qi) continue;
    const covered = spans.some(
      (s) => pi >= s.lo && pi <= s.hi && qi >= s.lo && qi <= s.hi && p.time >= s.from && p.time < s.to,
    );
    if (covered) result.push(i);
  }
  return result;
}
