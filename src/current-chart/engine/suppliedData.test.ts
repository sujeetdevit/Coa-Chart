import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { normalizeSnapshot } from '../adapters';
import { initialTimeWindow, pannableTimeExtent } from '../application/timeWindow';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { MS_PER_MINUTE } from '../domain';
import { CurrentChartEngine } from './CurrentChartEngine';

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
});
