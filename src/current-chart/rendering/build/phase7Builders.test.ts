import { event, smallBoard, train } from '../../../tests/fixtures/smallModel';
import { buildTrainScene } from '../../application/trainScene';
import { DEFAULT_CHART_CONFIG as config } from '../../configuration/chartConfig';
import { DEFAULT_CHART_THEME as theme } from '../../configuration/chartTheme';
import { MS_PER_HOUR, MS_PER_MINUTE, type CurrentChartModel } from '../../domain';
import { CurrentChartEngine, TrainHitIndex } from '../../engine';
import { forecastPointAt, rectBetween } from '../../interactions/trainPointer';
import { buildInteractionLayer } from './buildInteractionLayer';
import { buildMsmRenderModel } from './buildMsmRenderModel';

const T0 = Date.UTC(2026, 8, 20, 12, 0, 0);
const min = (m: number) => T0 + m * MS_PER_MINUTE;
const engine = CurrentChartEngine.create({
  board: smallBoard(),
  stage: { width: 1000, height: 440 },
  margins: theme.margins,
  window: { start: T0, end: T0 + 3 * MS_PER_HOUR },
  timeExtent: { start: T0 - 6 * MS_PER_HOUR, end: T0 + 3 * MS_PER_HOUR },
  now: min(60),
  config,
});

const model: CurrentChartModel = {
  board: smallBoard(),
  trains: [
    {
      ...train('T', [event(1, 'AAA', { departure: min(10) }), event(2, 'BBB', { arrival: min(20) })]),
      forecast: { kind: 'MANUAL', points: [{ stationCode: 'CCC', sectionId: 1, arrival: min(35) }] },
    },
  ],
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
const scene = buildTrainScene(engine, model, new Map(), config);

describe('interaction layer', () => {
  it('draws the box-zoom selection and the hovered overlay outline', () => {
    const items = buildInteractionLayer(scene, engine, theme, {
      selectionRect: { x: 100, y: 100, width: 50, height: 40 },
      overlayRect: { x: 10, y: 10, width: 5, height: 5 },
    }).flatMap((g) => g.items);
    expect(items.map((i) => i.id).sort()).toEqual(['hov-overlay', 'zoom-box']);
  });

  it('rings a hovered forecast point', () => {
    const items = buildInteractionLayer(scene, engine, theme, {
      hover: { trainId: 'T', forecastPointIndex: 1 },
    }).flatMap((g) => g.items);
    const ring = items.find((i) => i.id === 'hov-point');
    const { plot } = engine.getChartBounds();
    expect(ring?.kind === 'circle' && ring.x).toBeCloseTo(plot.x + engine.timeToX(min(35)), 6);
  });
});

describe('forecastPointAt', () => {
  it('finds a forecast vertex near the pointer', () => {
    const index = new TrainHitIndex(scene.items.map((i) => i.forecast));
    const { plot } = engine.getChartBounds();
    const p = scene.items[0]?.forecast.points[1];
    if (!p) throw new Error('no forecast point');
    expect(forecastPointAt(p.x + plot.x + 2, p.y + plot.y, engine, index)).toEqual({
      trainId: 'T',
      forecastPointIndex: 1,
    });
    expect(forecastPointAt(p.x + plot.x + 30, p.y + plot.y, engine, index)).toBeUndefined();
  });

  it('normalises a dragged rectangle', () => {
    expect(rectBetween({ x: 50, y: 80 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, width: 40, height: 60 });
  });
});

describe('MSM render model', () => {
  it('plots distance against time and maps x back to time', () => {
    const samples = [0, 1, 2].map((i) => ({ at: min(i), distanceKm: i * 2, speedKmph: 60 }));
    const plot = buildMsmRenderModel(samples, { width: 400, height: 200 }, theme, 'Red', () => '');
    const curve = plot.model.layers.movement[0]?.items.find((i) => i.id === 'curve');
    expect(curve?.kind === 'line' && curve.points.length).toBe(6);
    const firstX = curve?.kind === 'line' ? (curve.points[0] ?? NaN) : NaN;
    expect(plot.xToTime(firstX)).toBeCloseTo(min(0), 3);
  });
});
