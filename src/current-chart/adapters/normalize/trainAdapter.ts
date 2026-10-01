import {
  stationId,
  type AdapterDiagnostic,
  type Board,
  type CrewMember,
  type LocoAssignment,
  type Train,
  type TrainEvent,
} from '../../domain';
import type { CrewRow, LocoRow, MovementRow } from '../schemas';
import { parseCoaDateTime } from '../shared/coaDateTime';
import {
  defined,
  emptyToUndefined,
  groupBy,
  parseCategory,
  parseDirection,
  parseEventSource,
  parseMinutes,
} from './shared';

const SOURCE = 'movement';

function adaptEvent(row: MovementRow): TrainEvent {
  return {
    sequence: row.SEQNO,
    stationCode: row.STTNCODE,
    sectionId: row.SUBSCTNID,
    wrongLine: row.LINETYPE === 'REVS',
    isLastReported: row.LASTRPTFLG === 'Y',
    isDestination: row.DESTNFLAG === 'Y',
    ...defined({
      direction: parseDirection(row.DIRECTION),
      arrival: parseCoaDateTime(row.DPRTARVLTIME),
      departure: parseCoaDateTime(row.DPRTTIME),
      scheduledArrival: parseCoaDateTime(row.SCHARVL),
      scheduledDeparture: parseCoaDateTime(row.SCHDPRT),
      sectionGainLoss: parseMinutes(row.LOSS),
      stationGainLoss: parseMinutes(row.GAIN),
      lateMinutes: row.LT,
      // Non-positive speeds (e.g. -128) are sentinels, not measurements.
      speedKmph: row.CANSPEED !== null && row.CANSPEED > 0 ? row.CANSPEED : undefined,
      lineNo: row.LINENO ?? undefined,
      prevBoardId: row.PREVSTTNBRDID ?? undefined,
      nextBoardId: row.NXTSTTNBRDID ?? undefined,
      nextBlockSection: emptyToUndefined(row.BLCKSCTN),
      arrivalSource: parseEventSource(row.ArvlUserID),
      departureSource: parseEventSource(row.DepartureUserId),
    }),
  };
}

function adaptCrew(row: CrewRow): CrewMember | undefined {
  const signOn = parseCoaDateTime(row.SIGNONTIME);
  if (signOn === undefined) return undefined;
  return {
    name: row.CREWNAME,
    type: row.CREWTYPE,
    signOn,
    minutesOnDuty: row.COD,
    ...defined({
      signOff: parseCoaDateTime(row.SIGNOFFTIME),
      controllerName: emptyToUndefined(row.CLINAME),
    }),
  };
}

function adaptLoco(row: LocoRow): LocoAssignment | undefined {
  const reportedAt = parseCoaDateTime(row.CADEVENTRPTGTIME);
  if (reportedAt === undefined) return undefined;
  return {
    locoNumber: row.loconumb.trim(),
    attached: row.atchdtchflag === 'A',
    position: row.locoposn,
    reportedAt,
  };
}

/**
 * Builds trains from movement rows and attaches crew and locos.
 * Events at stations not on this board are dropped (they cannot be placed on the Y axis) and counted.
 */
export function adaptTrains(
  movementRows: MovementRow[],
  crewRows: CrewRow[],
  locoRows: LocoRow[],
  board: Board,
  diagnostics: AdapterDiagnostic[],
): Train[] {
  const onBoard = new Set(board.stations.map((s) => s.id));
  const crewByTrain = groupBy(crewRows, (r) => r.TRAINID);
  const locoByTrain = groupBy(locoRows, (r) => r.trainid);
  const offBoard = new Map<string, number>();
  const trains: Train[] = [];

  for (const [trainId, rows] of groupBy(movementRows, (r) => r.TRINID)) {
    const first = rows[0];
    if (!first) continue;

    const category = parseCategory(first.PGFLAG);
    if (category === undefined) {
      diagnostics.push({
        source: SOURCE,
        severity: 'warning',
        message: `Train ${trainId} has unknown PGFLAG "${first.PGFLAG}"; treated as OTHER`,
      });
    }

    const events: TrainEvent[] = [];
    for (const row of [...rows].sort((a, b) => a.SEQNO - b.SEQNO)) {
      if (!onBoard.has(stationId(row.SUBSCTNID, row.STTNCODE))) {
        offBoard.set(row.STTNCODE, (offBoard.get(row.STTNCODE) ?? 0) + 1);
        continue;
      }
      events.push(adaptEvent(row));
    }
    if (events.length === 0) continue;

    const crew = (crewByTrain.get(trainId) ?? []).flatMap((r) => adaptCrew(r) ?? []);
    const locos = (locoByTrain.get(trainId) ?? [])
      .flatMap((r) => adaptLoco(r) ?? [])
      .sort((a, b) => a.reportedAt - b.reportedAt || a.position - b.position);

    trains.push({
      id: trainId,
      name: first.TRAINNAME.trim(),
      category: category ?? 'OTHER',
      colour: first.COLORCODE,
      events,
      crew,
      locos,
      ...defined({
        number: emptyToUndefined(first.TRAINNO),
        completedAt: parseCoaDateTime(first.TRAINCMPLDATE),
      }),
    });
  }

  if (offBoard.size > 0) {
    const detail = [...offBoard].map(([code, n]) => `${code}×${n}`).join(', ');
    diagnostics.push({
      source: SOURCE,
      severity: 'info',
      message: `Skipped events at stations not on this board: ${detail}`,
    });
  }

  const trainIds = new Set(trains.map((t) => t.id));
  const unmatchedCrew = [...crewByTrain.keys()].filter((id) => !trainIds.has(id)).length;
  if (unmatchedCrew > 0) {
    diagnostics.push({
      source: 'crew',
      severity: 'info',
      message: `${unmatchedCrew} of ${crewByTrain.size} crew train IDs have no train on this chart`,
    });
  }

  return trains;
}
