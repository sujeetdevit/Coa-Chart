import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { normalizeSnapshot } from '../adapters';
import { initialTimeWindow, pannableTimeExtent } from '../application/timeWindow';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { MS_PER_MINUTE } from '../domain';
import { buildTrainScene } from '../application/trainScene';
import { CurrentChartEngine } from './CurrentChartEngine';
import { computeDwellLanes } from './dwellLanes';
import { TrainHitIndex } from './hitIndex';

describe('engine with the supplied data', () => {
  const model = normalizeSnapshot(loadSuppliedSnapshot());
  const window = initialTimeWindow(model.asOf, DEFAULT_CHART_CONFIG);
  const engine = CurrentChartEngine.create({
    board: model.board,
    stage: { width: 1600, height: 900 },
    margins: { top: 30, right: 80, bottom: 30, left: 80 },
    window,
    timeExtent: pannableTimeExtent(model, window, DEFAULT_CHART_CONFIG),
    now: model.asOf,
    config: DEFAULT_CHART_CONFIG,
  });

  it('places every station top to bottom inside the plot at fit zoom', () => {
    const placed = engine.getVisibleStations();
    expect(placed).toHaveLength(32);
    const ys = placed.map((p) => p.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(engine.getChartBounds().plot.height);
  });

  it('places every train vertex with finite coordinates', () => {
    let vertices = 0;
    for (const train of model.trains) {
      for (const p of engine.getTrainGeometry(train).points) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        vertices++;
      }
    }
    expect(vertices).toBeGreaterThan(3310); // at least one vertex per event, more where arr ≠ dep
  });

  it('puts the first train at UMB at the right time', () => {
    const first = model.trains[0];
    if (!first) throw new Error('no trains');
    const point = engine.getTrainGeometry(first).points[0];
    const umbArrival = first.events[0]?.arrival ?? NaN;
    expect(point?.stationId).toBe('20:UMB');
    expect(point?.x).toBeCloseTo(
      ((umbArrival - window.start) / MS_PER_MINUTE) * engine.viewport.time.pxPerMinute,
      6,
    );
    expect(point?.y).toBeCloseTo(engine.stationToY('20:UMB') ?? NaN, 9);
  });

  it('shows "now" inside the initial window', () => {
    expect(engine.getCurrentTimePosition().visible).toBe(true);
  });

  it('builds a scene of the trains in the initial window and hit-tests their points', () => {
    const lanes = computeDwellLanes(model.trains, DEFAULT_CHART_CONFIG.dwellLanes);
    const scene = buildTrainScene(engine, model, lanes);
    expect(scene.items.length).toBe(30);
    expect(scene.items.length).toBeLessThan(model.trains.length);

    const index = new TrainHitIndex(scene.items.map((i) => i.actual));
    const item = scene.items.find((i) => i.actual.points.length > 2);
    const point = item?.actual.points[1];
    if (!item || !point) throw new Error('no multi-point train in view');
    const hit = index.hitTest({ x: point.x + 1, y: point.y }, { vertexPx: 6, segmentPx: 5 });
    expect(hit?.kind).toBe('vertex');
    expect(
      scene.byId.get(hit?.trainId ?? '')?.actual.points[hit?.kind === 'vertex' ? hit.pointIndex : -1],
    ).toBeDefined();
  });

  it('assigns separate lanes to trains standing together', () => {
    const lanes = computeDwellLanes(model.trains, DEFAULT_CHART_CONFIG.dwellLanes);
    expect(lanes.size).toBeGreaterThan(0);
  });
});
