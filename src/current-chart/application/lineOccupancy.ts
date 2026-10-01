import {
  stationId,
  type CurrentChartModel,
  type EpochMs,
  type StationId,
  type StationLine,
  type Train,
} from '../domain';

/** Manual: red = occupied, green = free, light blue = nominated (no nomination data exists). */
export type LineState = 'OCCUPIED' | 'FREE';

export interface LineOccupancy {
  line: StationLine;
  state: LineState;
  train?: Train;
}

/**
 * State of every station line at a moment: a line is occupied by a train that has arrived on it
 * (reported line number) and not yet departed. Lines without a reported train are free.
 */
export function lineOccupancyAt(model: CurrentChartModel, at: EpochMs): Map<StationId, LineOccupancy[]> {
  const occupant = new Map<string, Train>();
  for (const train of model.trains) {
    for (const event of train.events) {
      if (event.lineNo === undefined || event.arrival === undefined || event.arrival > at) continue;
      if (event.departure !== undefined && event.departure <= at) continue;
      occupant.set(`${stationId(event.sectionId, event.stationCode)}#${event.lineNo}`, train);
    }
  }

  const result = new Map<StationId, LineOccupancy[]>();
  for (const station of model.board.stations) {
    result.set(
      station.id,
      station.lines.map((line) => {
        const train = occupant.get(`${station.id}#${line.lineNo}`);
        return train ? { line, state: 'OCCUPIED', train } : { line, state: 'FREE' };
      }),
    );
  }
  return result;
}

/** Short box label: M = main line, L = loop line, S = siding, then the line number. */
export function lineCode(line: StationLine): string {
  const prefix = line.type === 'MAIN' ? 'M' : line.type === 'LOOP' ? 'L' : line.type === 'SIDING' ? 'S' : '';
  return `${prefix}${line.lineNo}`;
}
