// Builders for small raw datasets in the source (API/JSON) shape, for adapter edge-case tests.
import type { RawChartSnapshot } from '../../current-chart/adapters';
import type {
  BlockRow,
  BoardDetailsRow,
  CautionRow,
  MovementRow,
} from '../../current-chart/adapters/schemas';

export function boardRow(
  code: string,
  section: number,
  seq: number,
  overrides: Partial<BoardDetailsRow> = {},
) {
  return {
    MANDSPLNUMB: section,
    MANDSPLSQNC: section,
    MANSTTNSQNC: seq,
    MAVSTTNCODE: code,
    MANDISTFROMREFSTTN: 100 - seq * 10,
    MANACTLDIST: 5,
    MANDSPLDIST: 8,
    MACCLASSFLAG: 'B',
    ...overrides,
  } satisfies BoardDetailsRow;
}

export function movementRow(
  trainId: string,
  seq: number,
  station: string,
  overrides: Partial<MovementRow> = {},
): MovementRow {
  return {
    TRINID: trainId,
    TRAINNO: '12345',
    TRAINNAME: `TRAIN ${trainId}`,
    DIRECTION: 'DN',
    PGFLAG: 'P',
    COLORCODE: 'Red',
    SUBSCTNID: 1,
    SEQNO: seq,
    STTNCODE: station,
    ISARVLACTUAL: 'A',
    ISDEPTACTUAL: 'A',
    DPRTARVLTIME: null,
    DPRTTIME: null,
    SCHARVL: null,
    SCHDPRT: null,
    LOSS: null,
    GAIN: null,
    LT: 0,
    LASTRPTFLG: 'N',
    DESTNFLAG: 'N',
    PREVSTTNBRDID: 3,
    NXTSTTNBRDID: 3,
    BLCKSCTN: '',
    CANSPEED: null,
    LINENO: null,
    LINETYPE: 'NRML',
    ArvlUserID: null,
    DepartureUserId: null,
    TRAINCMPLDATE: null,
    TOTALALLOWANCE: 0,
    ...overrides,
  };
}

export function blockRow(overrides: Partial<BlockRow> = {}): BlockRow {
  return {
    CAVBLCKRSTNID: 'B1',
    CANSCTNNUMB: 1,
    CAVSTTN: '',
    FROMSTTN: 'AAA',
    TOSTTN: 'BBB',
    BB: 'UP',
    CAVBLCKRSTNCODE: 'SIGNAL',
    CAVBLCKRSTNRMRK: 'TEST',
    CC: '20-09-26 10:00:00',
    DD: '20-09-26 11:00:00',
    EE: '20-09-26 10:05:00',
    FF: '20-09-26 11:20:00',
    CADCLEARTIME: null,
    CADPRMTEXTNDENDTIME: null,
    CACEXTNBRSTFLAG: 'A',
    ...overrides,
  };
}

export function cautionRow(overrides: Partial<CautionRow> = {}): CautionRow {
  return {
    SECTION: 'AAA-CCC',
    BLOCKSECTION: 'AAA-BBB',
    SUBSCTNUMB: 1,
    BOARDID: 3,
    DRTN: 'BOTH',
    LINENO: '1',
    PASSPEED: 30,
    GDSPEED: null,
    LOCATION: '10/0-11/0',
    FROMDATETIME: '20-09-26 08:00',
    TODATETIME: null,
    REASONDESC: 'TRACK WORK',
    DEPTCODE: 'ENGG-OPEN LINE',
    DAYHH: '1/2',
    ...overrides,
  };
}

/** Three stations AAA, BBB, CCC in section 1; everything else empty. */
export function smallSnapshot(overrides: Partial<RawChartSnapshot> = {}): RawChartSnapshot {
  return {
    boardDetails: [boardRow('AAA', 1, 1), boardRow('BBB', 1, 2), boardRow('CCC', 1, 3)],
    stationLines: [],
    movement: [],
    crew: [],
    loco: [],
    remarks: [],
    blocks: [],
    cautions: [],
    ...overrides,
  };
}
