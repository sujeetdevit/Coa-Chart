import { stationId, type Direction, type EpochMs, type StationId, type Train } from '../domain';

export type PathPointKind = 'arrival' | 'departure' | 'through' | 'forecast';

/** A train path vertex in chart space: a time and a station. Pixel placement is the engine's job. */
export interface TrainPathVertex {
  time: EpochMs;
  stationId: StationId;
  kind: PathPointKind;
  /** Index into `train.events` (or `train.forecast.points` for forecast vertices). */
  eventIndex: number;
  direction?: Direction;
  /** For forecast vertices: which time of the forecast point this vertex shows. */
  forecastField?: 'arrival' | 'departure';
}

/**
 * Ordered vertices of a train's actual run. Arrival then departure per station; an equal
 * arrival and departure collapses into one "through" vertex. Events without times add nothing.
 */
export function actualPathVertices(train: Train): TrainPathVertex[] {
  const vertices: TrainPathVertex[] = [];
  train.events.forEach((event, eventIndex) => {
    const base = {
      stationId: stationId(event.sectionId, event.stationCode),
      eventIndex,
      ...(event.direction ? { direction: event.direction } : {}),
    };
    const { arrival, departure } = event;
    if (arrival !== undefined && departure !== undefined && arrival === departure) {
      vertices.push({ ...base, time: arrival, kind: 'through' });
      return;
    }
    if (arrival !== undefined) vertices.push({ ...base, time: arrival, kind: 'arrival' });
    if (departure !== undefined) vertices.push({ ...base, time: departure, kind: 'departure' });
  });
  return vertices;
}

/** Ordered vertices of a train's forecast; empty when the train has none. */
export function forecastPathVertices(train: Train): TrainPathVertex[] {
  const vertices: TrainPathVertex[] = [];
  train.forecast?.points.forEach((point, eventIndex) => {
    const id = stationId(point.sectionId, point.stationCode);
    for (const [field, time] of [
      ['arrival', point.arrival],
      ['departure', point.departure],
    ] as const) {
      if (time === undefined) continue;
      const last = vertices[vertices.length - 1];
      if (last?.time === time && last.stationId === id) continue;
      vertices.push({ time, stationId: id, kind: 'forecast', eventIndex, forecastField: field });
    }
  });
  return vertices;
}
