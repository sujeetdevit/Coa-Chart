import { stationId, type EpochMs, type StationId, type Train } from '../domain';

export type PathPointKind = 'arrival' | 'departure' | 'through';

/** A train path vertex in chart space: a time and a station. Pixel placement is the engine's job. */
export interface TrainPathVertex {
  time: EpochMs;
  stationId: StationId;
  kind: PathPointKind;
  /** Index into `train.events`. */
  eventIndex: number;
}

/**
 * Ordered vertices of a train's actual run. Arrival then departure per station; an equal
 * arrival and departure collapses into one "through" vertex. Events without times add nothing.
 */
export function actualPathVertices(train: Train): TrainPathVertex[] {
  const vertices: TrainPathVertex[] = [];
  train.events.forEach((event, eventIndex) => {
    const id = stationId(event.sectionId, event.stationCode);
    const { arrival, departure } = event;
    if (arrival !== undefined && departure !== undefined && arrival === departure) {
      vertices.push({ time: arrival, stationId: id, kind: 'through', eventIndex });
      return;
    }
    if (arrival !== undefined) vertices.push({ time: arrival, stationId: id, kind: 'arrival', eventIndex });
    if (departure !== undefined)
      vertices.push({ time: departure, stationId: id, kind: 'departure', eventIndex });
  });
  return vertices;
}
