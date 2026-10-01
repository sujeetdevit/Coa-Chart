import type { DwellLaneConfig } from '../configuration/chartConfig';
import { MS_PER_MINUTE, stationId, type Train } from '../domain';

/** Lane index per (train, event). Lane 0 = drawn on the station line; absent = lane 0. */
export type DwellLanes = ReadonlyMap<string, number>;

export function dwellLaneKey(trainId: string, eventIndex: number): string {
  return `${trainId}#${eventIndex}`;
}

/**
 * Assigns a lane to every dwell (arrival → departure at one station) of at least
 * `minDwellMinutes`, so trains standing at the same station at the same time don't overlap.
 * Greedy interval packing per station: each dwell takes the lowest lane free at its arrival.
 */
export function computeDwellLanes(trains: Train[], config: DwellLaneConfig): DwellLanes {
  const minMs = config.minDwellMinutes * MS_PER_MINUTE;
  const byStation = new Map<string, { key: string; start: number; end: number }[]>();

  for (const train of trains) {
    train.events.forEach((event, index) => {
      const { arrival, departure } = event;
      if (arrival === undefined || departure === undefined || departure - arrival < minMs) return;
      const id = stationId(event.sectionId, event.stationCode);
      const list = byStation.get(id) ?? [];
      list.push({ key: dwellLaneKey(train.id, index), start: arrival, end: departure });
      byStation.set(id, list);
    });
  }

  const lanes = new Map<string, number>();
  for (const dwells of byStation.values()) {
    dwells.sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
    const laneEnds: number[] = [];
    for (const dwell of dwells) {
      let lane = laneEnds.findIndex((end) => end <= dwell.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = dwell.end;
      if (lane > 0) lanes.set(dwell.key, lane);
    }
  }
  return lanes;
}
