import type { Board, EpochMs, MidSectionSample, Station, Train } from '../domain';
import type { TrainPathPoint } from '../engine';

/** A block section already traversed by a train (manual §11.1 MSM). */
export interface MsmRequest {
  train: Train;
  from: Station;
  to: Station;
  departure: EpochMs;
  arrival: EpochMs;
}

export interface MsmResult {
  samples: MidSectionSample[];
  source: 'server' | 'sample' | 'none';
  message?: string;
}

/** Mid-block-section positions (GPS/RTIS) for a traversed block section. */
export interface MsmProvider {
  midSection(request: MsmRequest): Promise<MsmResult>;
}

/**
 * The MSM request for a clicked actual-path segment, if it is a traversed block section: it
 * leaves one station (departure/through) and reaches a different one (arrival/through).
 */
export function msmRequestFor(
  train: Train,
  points: TrainPathPoint[],
  segmentIndex: number,
  board: Board,
): MsmRequest | undefined {
  const a = points[segmentIndex];
  const b = points[segmentIndex + 1];
  if (!a || !b || a.stationId === b.stationId) return undefined;
  if (a.kind !== 'departure' && a.kind !== 'through') return undefined;
  if (b.kind !== 'arrival' && b.kind !== 'through') return undefined;
  const from = board.stations.find((s) => s.id === a.stationId);
  const to = board.stations.find((s) => s.id === b.stationId);
  if (!from || !to || b.time <= a.time) return undefined;
  return { train, from, to, departure: a.time, arrival: b.time };
}

/** Speed and time of the sample nearest to a moment (MSM tooltip). */
export function nearestSample(samples: MidSectionSample[], at: EpochMs): MidSectionSample | undefined {
  let best: MidSectionSample | undefined;
  for (const s of samples) if (!best || Math.abs(s.at - at) < Math.abs(best.at - at)) best = s;
  return best;
}
