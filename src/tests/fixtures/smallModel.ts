import { normalizeSnapshot } from '../../current-chart/adapters';
import type { Board, Train, TrainEvent } from '../../current-chart/domain';
import { boardRow, smallSnapshot } from './rawRows';

/**
 * Board: AAA, BBB, CCC in section 1 and DDD in section 2, all with display distance 8.
 * With default spacing (edge padding 3, section factor 1.5) the offsets are 3, 11, 19, 31; total 34.
 */
export function smallBoard(): Board {
  return normalizeSnapshot(
    smallSnapshot({
      boardDetails: [
        boardRow('AAA', 1, 1),
        boardRow('BBB', 1, 2),
        boardRow('CCC', 1, 3),
        boardRow('DDD', 2, 1),
      ],
    }),
  ).board;
}

export function event(
  sequence: number,
  stationCode: string,
  times: { arrival?: number; departure?: number },
  sectionId = 1,
): TrainEvent {
  return {
    sequence,
    stationCode,
    sectionId,
    wrongLine: false,
    isLastReported: false,
    isDestination: false,
    ...times,
  };
}

export function train(id: string, events: TrainEvent[]): Train {
  return { id, name: id, category: 'PASSENGER', colour: 'Red', events, crew: [], locos: [] };
}
