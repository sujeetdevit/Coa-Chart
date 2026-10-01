import { event, smallBoard, train } from '../../tests/fixtures/smallModel';
import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { normalizeSnapshot } from '../adapters';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { MS_PER_MINUTE, type CurrentChartModel, type Train, type TrainForecast } from '../domain';
import type { TrainPathPoint } from '../engine';
import { InMemoryEpenStore } from './epen';
import { withForecasts } from './forecast/forecastDisplay';
import { forecastWorkflowReducer, INITIAL_FORECAST_STATE } from './forecast/forecastWorkflow';
import { moveForecastTime, toManual } from './forecast/manualForecast';
import { freezeReducer } from './freeze';
import { colourLegend, handoverSummary } from './legend';
import { msmRequestFor, nearestSample } from './msm';
import { isTrainVisible, NO_FILTERS, trainDirection } from './trainFilters';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);
const min = (m: number) => T0 + m * MS_PER_MINUTE;

describe('train filters', () => {
  const goodsUp: Train = {
    ...train('G', [{ ...event(1, 'AAA', { departure: min(0) }), direction: 'UP' }]),
    category: 'GOODS',
  };
  const passDn: Train = {
    ...train('P', [
      { ...event(1, 'AAA', { departure: min(0) }), direction: 'UP' },
      { ...event(2, 'BBB', { arrival: min(9) }), direction: 'DN' },
    ]),
    category: 'PASSENGER',
  };

  it('shows everything with no filters', () => {
    expect([goodsUp, passDn].every((t) => isTrainVisible(t, NO_FILTERS))).toBe(true);
  });

  it('shows only ticked categories (union) when any are ticked', () => {
    const goods = { ...NO_FILTERS, categories: { GOODS: true, PASSENGER: false, OTHER: false } };
    expect(isTrainVisible(goodsUp, goods)).toBe(true);
    expect(isTrainVisible(passDn, goods)).toBe(false);
    const both = { ...NO_FILTERS, categories: { GOODS: true, PASSENGER: true, OTHER: false } };
    expect(isTrainVisible(passDn, both)).toBe(true);
  });

  it('filters by the current (latest) direction', () => {
    expect(trainDirection(passDn)).toBe('DN');
    expect(isTrainVisible(passDn, { ...NO_FILTERS, direction: 'UP' })).toBe(false);
    expect(isTrainVisible(goodsUp, { ...NO_FILTERS, direction: 'UP' })).toBe(true);
  });
});

describe('freezeReducer', () => {
  it('holds new data while frozen and shows the latest on unfreeze', () => {
    let s = freezeReducer({ frozen: false, shown: 1 }, { type: 'freeze' });
    s = freezeReducer(s, { type: 'data', data: 2 });
    s = freezeReducer(s, { type: 'data', data: 3 });
    expect(s).toEqual({ frozen: true, shown: 1, pending: 3 });
    expect(freezeReducer(s, { type: 'unfreeze' })).toEqual({ frozen: false, shown: 3 });
  });

  it('passes data straight through when not frozen', () => {
    expect(freezeReducer({ frozen: false, shown: 1 }, { type: 'data', data: 2 })).toEqual({
      frozen: false,
      shown: 2,
    });
  });
});

const forecast: TrainForecast = {
  kind: 'FULL',
  points: [
    { stationCode: 'BBB', sectionId: 1, arrival: min(30), departure: min(32) },
    { stationCode: 'CCC', sectionId: 1, arrival: min(45), departure: min(45) },
    { stationCode: 'DDD', sectionId: 2, arrival: min(200) },
  ],
};

function model(trains: Train[]): CurrentChartModel {
  return {
    board: smallBoard(),
    trains,
    blocks: [],
    cautions: [],
    trainRemarks: [],
    chartRemarks: [],
    unusualOccurrences: [],
    tsl: [],
    gpsLocoMovements: [],
    epenMessages: [],
    asOf: min(20),
    diagnostics: [],
  };
}

describe('withForecasts (Forecast Hour / Forecast Past Time)', () => {
  const recent = train('R', [event(1, 'AAA', { departure: min(10) })]);
  const old = train('O', [event(1, 'AAA', { departure: min(-300) })]);
  const config = DEFAULT_CHART_CONFIG.forecast; // 2 h ahead, 120 min past

  it('attaches forecasts within the horizon to recently reported trains only', () => {
    const result = withForecasts(
      model([recent, old]),
      new Map([
        ['R', forecast],
        ['O', forecast],
      ]),
      min(20),
      config,
    );
    const r = result.trains.find((t) => t.id === 'R');
    expect(r?.forecast?.points.map((p) => p.stationCode)).toEqual(['BBB', 'CCC']); // DDD at +180 min is beyond 2 h
    expect(result.trains.find((t) => t.id === 'O')?.forecast).toBeUndefined();
  });

  it('returns the model unchanged with no forecasts', () => {
    const m = model([recent]);
    expect(withForecasts(m, new Map(), min(20), config)).toBe(m);
  });
});

describe('manual forecast', () => {
  it('moves a time and shifts all later times by the same amount', () => {
    const moved = moveForecastTime(forecast, 1, 'arrival', min(50));
    expect(moved.kind).toBe('MANUAL');
    expect(moved.points[0]).toEqual(forecast.points[0]);
    expect(moved.points[1]).toMatchObject({ arrival: min(50), departure: min(50) });
    expect(moved.points[2]).toMatchObject({ arrival: min(205) });
  });

  it('moving a departure keeps that station’s arrival', () => {
    const moved = moveForecastTime(forecast, 0, 'departure', min(40));
    expect(moved.points[0]).toMatchObject({ arrival: min(30), departure: min(40) });
    expect(moved.points[1]).toMatchObject({ arrival: min(53) });
  });

  it('cannot move a time before the previous one', () => {
    const moved = moveForecastTime(forecast, 1, 'arrival', min(0));
    expect(moved.points[1]?.arrival).toBe(min(32)); // clamped to BBB departure
  });

  it('copies into manual forecasts', () => {
    const manual = toManual(new Map([['T', forecast]]));
    expect(manual.get('T')?.kind).toBe('MANUAL');
    expect(manual.get('T')?.points[0]).not.toBe(forecast.points[0]);
  });
});

describe('forecastWorkflowReducer', () => {
  const result = { forecasts: new Map([['T', forecast]]), source: 'sample' as const, message: 'sample' };

  it('shows a full forecast, requires the Manual option before MF, then allows dragging', () => {
    let s = forecastWorkflowReducer(INITIAL_FORECAST_STATE, { type: 'result', mode: 'full', result });
    expect(s).toMatchObject({ mode: 'full', source: 'sample', message: 'sample' });

    s = forecastWorkflowReducer(s, { type: 'convertToManual' });
    expect(s.mode).toBe('full');
    expect(s.message).toMatch(/Manual option/);

    s = forecastWorkflowReducer(s, { type: 'setOption', option: 'manualOption', value: true });
    s = forecastWorkflowReducer(s, { type: 'convertToManual' });
    expect(s.mode).toBe('manual');

    s = forecastWorkflowReducer(s, {
      type: 'moveManual',
      trainId: 'T',
      pointIndex: 1,
      field: 'arrival',
      time: min(60),
    });
    expect(s.shown.get('T')?.points[1]?.arrival).toBe(min(60));
  });

  it('does not convert when there is nothing to convert', () => {
    const s = forecastWorkflowReducer(
      { ...INITIAL_FORECAST_STATE, manualOption: true },
      { type: 'convertToManual' },
    );
    expect(s.mode).toBe('none');
  });

  it('adds a single-train forecast to what is shown', () => {
    const s = forecastWorkflowReducer(INITIAL_FORECAST_STATE, { type: 'single', result });
    expect(s.mode).toBe('basic');
    expect(s.shown.size).toBe(1);
  });

  it('reset clears forecasts but keeps the options and halts', () => {
    const halts = [
      { trainId: 'T', minutes: 5, location: { kind: 'station' as const, sectionId: 1, stationCode: 'BBB' } },
    ];
    let s = forecastWorkflowReducer(INITIAL_FORECAST_STATE, { type: 'result', mode: 'full', result });
    s = forecastWorkflowReducer({ ...s, manualOption: true, halts }, { type: 'reset' });
    expect(s).toMatchObject({ mode: 'none', manualOption: true, halts });
    expect(s.shown.size).toBe(0);
  });
});

describe('MSM', () => {
  const board = smallBoard();
  const pt = (code: string, time: number, kind: TrainPathPoint['kind']): TrainPathPoint => ({
    x: 0,
    y: 0,
    time,
    stationId: `1:${code}`,
    kind,
    eventIndex: 0,
  });
  const t = train('T', []);

  it('accepts a traversed block section only', () => {
    const points = [
      pt('AAA', min(0), 'arrival'),
      pt('AAA', min(2), 'departure'),
      pt('BBB', min(9), 'arrival'),
    ];
    expect(msmRequestFor(t, points, 1, board)).toMatchObject({ from: { code: 'AAA' }, to: { code: 'BBB' } });
    expect(msmRequestFor(t, points, 0, board)).toBeUndefined(); // dwell at AAA
  });

  it('finds the nearest sample', () => {
    const samples = [0, 30, 60].map((s) => ({ at: min(0) + s * 1000, distanceKm: s, speedKmph: s }));
    expect(nearestSample(samples, min(0) + 40_000)?.speedKmph).toBe(30);
  });
});

describe('EPEN store', () => {
  it('lists messages within a time period', async () => {
    const store = new InMemoryEpenStore();
    await store.save({ id: '1', at: min(10), payload: 'a', savedAt: min(10) });
    await store.save({ id: '2', at: min(90), payload: 'b', savedAt: min(90) });
    expect((await store.list({ start: min(0), end: min(60) })).map((m) => m.id)).toEqual(['1']);
  });
});

describe('legends with the supplied data', () => {
  const supplied = normalizeSnapshot(loadSuppliedSnapshot());

  it('lists the 9 data colours with their categories', () => {
    const legend = colourLegend(supplied);
    expect(legend).toHaveLength(9);
    expect(legend.reduce((n, e) => n + e.trainCount, 0)).toBe(196);
  });

  it('summarises trains handed over by board (none are taken over in this data)', () => {
    const summary = handoverSummary(supplied);
    expect(summary.handedOver.map((e) => [e.boardId, e.trains.length])).toEqual([
      [1, 64],
      [4, 4],
      [7, 8],
    ]);
    expect(summary.takenOver).toEqual([]);
  });
});
