import { event, smallBoard, train } from '../../tests/fixtures/smallModel';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { MS_PER_MINUTE, type Block, type Caution, type CurrentChartModel, type Train } from '../domain';
import type { TrainPathPoint } from '../engine';
import { blockPeriod } from './blockPeriods';
import { activeCautionGroups, cautionSpeedText, isCautionInForce } from './cautions';
import { crewLabelLines, isBlinkOff, isCrewOverDuty } from './crew';
import { isGpsTrain } from './gps';
import { lineCode, lineOccupancyAt } from './lineOccupancy';
import { tslSegmentIndices } from './tsl';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);
const min = (m: number) => T0 + m * MS_PER_MINUTE;
const crewConfig = DEFAULT_CHART_CONFIG.crew;

describe('crew', () => {
  const withCrew = (minutesOnDuty: number, signOff?: number): Train => ({
    ...train('T', []),
    crew: [{ name: 'MOHIT', type: 'DR', signOn: min(0), minutesOnDuty, ...(signOff ? { signOff } : {}) }],
  });

  it('flags crew on duty for 7 hours or more', () => {
    expect(isCrewOverDuty(withCrew(419), crewConfig)).toBe(false);
    expect(isCrewOverDuty(withCrew(420), crewConfig)).toBe(true);
  });

  it('ignores crew who have signed off', () => {
    expect(isCrewOverDuty(withCrew(600, min(500)), crewConfig)).toBe(false);
  });

  it('labels crew as type and name', () => {
    expect(crewLabelLines(withCrew(10))).toEqual(['DR MOHIT']);
  });

  it('blinks during the first 20 s of every minute, toggling every 500 ms', () => {
    const minute = 60_000 * 1000; // any whole minute
    expect(isBlinkOff(minute + 100, crewConfig)).toBe(false);
    expect(isBlinkOff(minute + 600, crewConfig)).toBe(true);
    expect(isBlinkOff(minute + 1_100, crewConfig)).toBe(false);
    expect(isBlinkOff(minute + 19_600, crewConfig)).toBe(true);
    expect(isBlinkOff(minute + 20_600, crewConfig)).toBe(false); // after the 20 s window
    expect(isBlinkOff(minute + 45_600, crewConfig)).toBe(false);
  });
});

describe('isGpsTrain', () => {
  it('is true when any report came from RTIS or REMLOT', () => {
    expect(
      isGpsTrain(train('T', [{ ...event(1, 'AAA', { departure: min(0) }), departureSource: 'RTIS' }])),
    ).toBe(true);
    expect(
      isGpsTrain(train('T', [{ ...event(1, 'AAA', { arrival: min(0) }), arrivalSource: 'REMLOT' }])),
    ).toBe(true);
    expect(
      isGpsTrain(train('T', [{ ...event(1, 'AAA', { departure: min(0) }), departureSource: 'MANUAL' }])),
    ).toBe(false);
  });
});

function modelWith(trains: Train[]): CurrentChartModel {
  const board = smallBoard();
  const bbb = board.stations.find((s) => s.code === 'BBB');
  if (bbb) {
    bbb.lines = [
      { lineNo: 1, name: '1', type: 'MAIN' },
      { lineNo: 2, name: '2', type: 'LOOP' },
    ];
  }
  return {
    board,
    trains,
    blocks: [],
    cautions: [],
    trainRemarks: [],
    chartRemarks: [],
    unusualOccurrences: [],
    tsl: [],
    gpsLocoMovements: [],
    epenMessages: [],
    asOf: min(60),
    diagnostics: [],
  };
}

describe('lineOccupancyAt', () => {
  const standing = train('S', [{ ...event(1, 'BBB', { arrival: min(10) }), lineNo: 2 }]);
  const gone = train('G', [{ ...event(1, 'BBB', { arrival: min(10), departure: min(20) }), lineNo: 1 }]);
  const later = train('L', [{ ...event(1, 'BBB', { arrival: min(90) }), lineNo: 1 }]);

  it('marks a line occupied by a train that arrived on it and has not departed', () => {
    const states = lineOccupancyAt(modelWith([standing, gone, later]), min(30)).get('1:BBB') ?? [];
    expect(states.map((s) => [lineCode(s.line), s.state, s.train?.id])).toEqual([
      ['M1', 'FREE', undefined],
      ['L2', 'OCCUPIED', 'S'],
    ]);
  });

  it('frees the line once the train departs', () => {
    const states = lineOccupancyAt(modelWith([gone]), min(15)).get('1:BBB') ?? [];
    expect(states[0]?.state).toBe('OCCUPIED');
    expect((lineOccupancyAt(modelWith([gone]), min(20)).get('1:BBB') ?? [])[0]?.state).toBe('FREE');
  });
});

describe('cautions', () => {
  const caution = (over: Partial<Caution>): Caution => ({
    location: { kind: 'blockSection', sectionId: 1, fromStationCode: 'AAA', toStationCode: 'BBB' },
    sectionName: 'AAA-CCC',
    direction: 'UP',
    kmLocation: '1/0-2/0',
    from: min(0),
    reason: 'TRACK',
    department: 'ENGG',
    inForce: '1/0',
    ...over,
  });

  it('is in force from its start until its end', () => {
    expect(isCautionInForce(caution({}), min(-1))).toBe(false);
    expect(isCautionInForce(caution({}), min(0))).toBe(true);
    expect(isCautionInForce(caution({ to: min(10) }), min(10))).toBe(false);
  });

  it('groups by location and direction with the most restrictive speeds', () => {
    const groups = activeCautionGroups(
      [
        caution({ passengerSpeed: 60, goodsSpeed: 45 }),
        caution({ passengerSpeed: 30 }),
        caution({ direction: 'DN', passengerSpeed: 20 }),
        caution({ to: min(5) }),
      ],
      min(10),
    );
    expect(groups).toHaveLength(2);
    const up = groups.find((g) => g.direction === 'UP');
    expect(up?.cautions).toHaveLength(2);
    expect(up && cautionSpeedText(up)).toBe('P30 G45');
  });
});

describe('blockPeriod', () => {
  const block = (over: Partial<Block>): Block => ({
    id: 'B',
    location: { kind: 'station', sectionId: 1, stationCode: 'BBB' },
    direction: 'UP',
    department: 'SIGNAL',
    reason: 'TEST',
    permitted: { start: min(0), end: min(60) },
    actual: {},
    ...over,
  });

  it('uses the permitted window for a block not started', () => {
    expect(blockPeriod(block({}), min(30))).toEqual({
      start: min(0),
      end: min(60),
      permittedOnly: true,
      ongoing: false,
    });
  });

  it('draws the actual period with AST/AET and no burst when it ends in time', () => {
    expect(blockPeriod(block({ actual: { start: min(5), end: min(50) } }), min(100))).toEqual({
      start: min(5),
      end: min(50),
      permittedOnly: false,
      ongoing: false,
      ast: min(5),
      aet: min(50),
    });
  });

  it('marks the over-run beyond the permitted end as burst', () => {
    const period = blockPeriod(block({ actual: { start: min(5), end: min(80) } }), min(100));
    expect(period?.burst).toEqual({ start: min(60), end: min(80) });
  });

  it('honours a permitted extension', () => {
    const period = blockPeriod(
      block({ actual: { start: min(5), end: min(80) }, permittedExtendedEnd: min(90) }),
      min(100),
    );
    expect(period?.burst).toBeUndefined();
  });

  it('runs an unfinished block up to now', () => {
    const period = blockPeriod(block({ actual: { start: min(5) } }), min(70));
    expect(period).toMatchObject({ end: min(70), ongoing: true, burst: { start: min(60), end: min(70) } });
    expect(period?.aet).toBeUndefined();
  });

  it('uses the clearance time when there is no actual end', () => {
    expect(blockPeriod(block({ actual: { start: min(5) }, clearedAt: min(40) }), min(70))?.end).toBe(min(40));
  });
});

describe('tslSegmentIndices', () => {
  const board = smallBoard(); // AAA, BBB, CCC (section 1), DDD (section 2)
  const pt = (code: string, time: number, section = 1): TrainPathPoint => ({
    x: 0,
    y: 0,
    time,
    stationId: `${section}:${code}`,
    kind: 'through',
    eventIndex: 0,
  });
  const points = [pt('AAA', min(0)), pt('BBB', min(10)), pt('CCC', min(20)), pt('DDD', min(30), 2)];
  const tsl = {
    sectionId: 1,
    fromStationCode: 'AAA',
    toStationCode: 'CCC',
    line: 'UP',
    introducedAt: min(5),
    reason: 'TEST',
  };

  it('selects segments inside the TSL stations while it is in force', () => {
    expect(tslSegmentIndices(points, [tsl], board)).toEqual([1]); // BBB→CCC; AAA→BBB starts before TSL
    expect(tslSegmentIndices(points, [{ ...tsl, introducedAt: min(0) }], board)).toEqual([0, 1]);
  });

  it('stops at cancellation and ignores no TSL', () => {
    expect(tslSegmentIndices(points, [{ ...tsl, cancelledAt: min(10) }], board)).toEqual([]);
    expect(tslSegmentIndices(points, [], board)).toEqual([]);
  });
});
