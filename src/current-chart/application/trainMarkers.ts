import type { Train } from '../domain';

/** Which vertex of an event a marker sits on. */
export interface MarkerAnchor {
  eventIndex: number;
  at: 'arrival' | 'departure';
}

/**
 * Point icons and handover arrows for a train (manual §11.1 "Icons shown in the chart").
 *
 * - departed (green): the train left its originating station, which is on this board.
 * - floating (red): the last reported station while the train is running.
 * - destination (square): the train terminated.
 * - not departed (blue, shows ETD): needs planned departures, which the data does not contain.
 * - handover in/out arrows: the train came from / leaves for another board (legacy behaviour).
 */
export interface TrainMarkers {
  departed?: MarkerAnchor;
  floating?: MarkerAnchor;
  destination?: MarkerAnchor;
  handoverIn: boolean;
  handoverOut: boolean;
}

export function deriveTrainMarkers(train: Train, boardId: number | undefined): TrainMarkers {
  const first = train.events[0];
  const last = train.events[train.events.length - 1];
  const markers: TrainMarkers = { handoverIn: false, handoverOut: false };
  if (!first || !last) return markers;

  // Originating here: first event has a departure but no arrival.
  if (first.arrival === undefined && first.departure !== undefined) {
    markers.departed = { eventIndex: 0, at: 'departure' };
  }

  const destinationIndex = train.events.findIndex((e) => e.isDestination);
  const destination = train.events[destinationIndex];
  if (destination) {
    markers.destination = {
      eventIndex: destinationIndex,
      at: destination.arrival !== undefined ? 'arrival' : 'departure',
    };
  } else {
    const lastReportedIndex = findLastIndex(train.events, (e) => e.isLastReported);
    const lastReported = train.events[lastReportedIndex];
    if (lastReported && (lastReported.arrival !== undefined || lastReported.departure !== undefined)) {
      markers.floating = {
        eventIndex: lastReportedIndex,
        at: lastReported.departure !== undefined ? 'departure' : 'arrival',
      };
    }
  }

  if (boardId !== undefined) {
    markers.handoverIn = first.prevBoardId !== undefined && first.prevBoardId !== boardId;
    markers.handoverOut = !destination && last.nextBoardId !== undefined && last.nextBoardId !== boardId;
  }
  return markers;
}

function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}
