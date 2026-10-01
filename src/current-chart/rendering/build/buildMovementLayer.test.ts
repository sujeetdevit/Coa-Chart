import { event, smallBoard, train } from '../../../tests/fixtures/smallModel';
import { defaultDisplayOptions, type ChartDisplayOptions } from '../../application/displayOptions';
import { buildTrainScene } from '../../application/trainScene';
import { DEFAULT_CHART_CONFIG as config } from '../../configuration/chartConfig';
import { DEFAULT_CHART_THEME as theme } from '../../configuration/chartTheme';
import {
  MS_PER_HOUR,
  MS_PER_MINUTE,
  type CurrentChartModel,
  type Train,
  type TrainEvent,
} from '../../domain';
import { CurrentChartEngine } from '../../engine';
import type { Primitive, PrimitiveGroup } from '../types';
import { buildMovementLayer } from './buildMovementLayer';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);
const min = (m: number) => T0 + m * MS_PER_MINUTE;
const board = { ...smallBoard(), id: 3 };

const engine = CurrentChartEngine.create({
  board,
  stage: { width: 1000, height: 440 },
  margins: theme.margins,
  window: { start: T0, end: T0 + 3 * MS_PER_HOUR },
  timeExtent: { start: T0 - 6 * MS_PER_HOUR, end: T0 + 3 * MS_PER_HOUR },
  now: min(60),
  config,
});

const ev = (e: TrainEvent, extra: Partial<TrainEvent>): TrainEvent => ({ ...e, ...extra });

function model(trains: Train[]): CurrentChartModel {
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

function build(trains: Train[], options: Partial<ChartDisplayOptions> = {}): Primitive[] {
  const scene = buildTrainScene(engine, model(trains), new Map());
  const groups: PrimitiveGroup[] = buildMovementLayer(
    scene,
    engine,
    { ...defaultDisplayOptions(config), ...options },
    config,
    theme,
  );
  return groups.flatMap((g) => g.items);
}

const running = {
  ...train('T1', [
    ev(event(1, 'AAA', { departure: min(10) }), { direction: 'DN', stationGainLoss: 2 }),
    ev(event(2, 'BBB', { arrival: min(20), departure: min(25) }), {
      direction: 'DN',
      sectionGainLoss: -1,
      stationGainLoss: 0,
      speedKmph: 87,
    }),
    ev(event(3, 'CCC', { arrival: min(40) }), { direction: 'DN', isLastReported: true }),
  ]),
  number: '12345',
  colour: 'DeepPink',
};

describe('buildMovementLayer', () => {
  it('draws the actual run as a solid line in the train colour with a tick per vertex', () => {
    const items = build([running]);
    const line = items.find((p) => p.id === 'ln:T1');
    expect(line).toMatchObject({ kind: 'line', stroke: 'DeepPink' });
    expect(line && 'dash' in line ? line.dash : undefined).toBeUndefined();
    const ticks = items.find((p) => p.id === 'tk:T1');
    expect(ticks?.kind === 'segments' && ticks.points.length).toBe(4 * 4); // 4 vertices × one segment
  });

  it('marks the originating departure green and the last report red', () => {
    const items = build([running]);
    expect(items.find((p) => p.id === 'pd:T1')).toMatchObject({
      kind: 'circle',
      fill: theme.movement.departedPoint,
    });
    const floating = items.find((p) => p.id === 'pf:T1');
    expect(floating).toMatchObject({ kind: 'circle', fill: theme.movement.floatingPoint });
    const { plot } = engine.getChartBounds();
    expect(floating?.kind === 'circle' && floating.x).toBeCloseTo(plot.x + engine.timeToX(min(40)), 6);
  });

  it('labels the train at its start with the train number', () => {
    const items = build([running]);
    expect(items.find((p) => p.id === 'lt:T1:start')).toMatchObject({
      kind: 'text',
      text: '12345',
      fill: 'DeepPink',
    });
    expect(items.some((p) => p.id === 'lt:T1:end')).toBe(false);
    expect(build([running], { showLastTrainLabel: true }).some((p) => p.id === 'lt:T1:end')).toBe(true);
  });

  it('shows gain/loss only when enabled: detention red, gain green, zero hidden', () => {
    expect(build([running]).some((p) => p.id.startsWith('gl'))).toBe(false);
    const figures = build([running], { showGainLoss: true }).filter((p) => p.id.startsWith('gl'));
    expect(figures.map((p) => (p.kind === 'text' ? [p.text, p.fill] : []))).toEqual([
      ['2', theme.movement.detention], // station loss at AAA
      ['1', theme.movement.gain], // section gain into BBB
    ]);
  });

  it('shows speed at departures only when enabled', () => {
    expect(build([running]).some((p) => p.id.startsWith('sp:'))).toBe(false);
    const speeds = build([running], { showSpeed: true }).filter((p) => p.id.startsWith('sp:'));
    expect(speeds).toHaveLength(1);
    expect(speeds[0]).toMatchObject({ text: '87', fill: theme.movement.speedDown });
  });

  it('draws a terminating square instead of the floating point', () => {
    const terminated = train('T2', [
      event(1, 'AAA', { departure: min(10) }),
      ev(event(2, 'BBB', { arrival: min(20) }), { isDestination: true, isLastReported: true }),
    ]);
    const items = build([terminated]);
    expect(items.find((p) => p.id === 'pq:T2')).toMatchObject({
      kind: 'rect',
      fill: theme.movement.destinationSquare,
    });
    expect(items.some((p) => p.id === 'pf:T2')).toBe(false);
  });

  it('draws handover arrows for trains entering from and leaving to other boards', () => {
    const through = train('T3', [
      ev(event(1, 'AAA', { arrival: min(10), departure: min(11) }), { prevBoardId: 1, nextBoardId: 3 }),
      ev(event(2, 'CCC', { arrival: min(30), departure: min(31) }), { prevBoardId: 3, nextBoardId: 7 }),
    ]);
    const items = build([through]);
    expect(items.find((p) => p.id === 'ai:T3')?.kind).toBe('line');
    expect(items.find((p) => p.id === 'ao:T3')?.kind).toBe('line');
  });

  it('marks wrong-line running with W/L on the following segment', () => {
    const wrong = train('T4', [
      ev(event(1, 'AAA', { departure: min(10) }), { wrongLine: true }),
      event(2, 'BBB', { arrival: min(20) }),
    ]);
    expect(build([wrong]).find((p) => p.id.startsWith('wl:T4'))).toMatchObject({ text: 'W/L' });
  });

  it('draws a forecast as a dashed line in the default forecast colour', () => {
    const forecasted: Train = {
      ...running,
      forecast: {
        kind: 'FULL',
        points: [{ stationCode: 'DDD', sectionId: 2, arrival: min(70), departure: min(72) }],
      },
    };
    const forecast = build([forecasted]).find((p) => p.id === 'fc:T1');
    expect(forecast).toMatchObject({
      kind: 'line',
      stroke: config.forecast.defaultColour,
      dash: theme.movement.forecastDash,
      opacity: config.forecast.opacity,
    });
    // Starts at the last actual vertex (CCC arrival) and continues to DDD.
    expect(forecast?.kind === 'line' && forecast.points.length).toBe(6);
  });

  it('leaves out trains entirely outside the visible window', () => {
    const old = train('OLD', [
      event(1, 'AAA', { departure: min(-300) }),
      event(2, 'BBB', { arrival: min(-290) }),
    ]);
    expect(build([old]).some((p) => p.id.includes('OLD'))).toBe(false);
  });
});
