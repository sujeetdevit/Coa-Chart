import { event, smallBoard, train } from '../../tests/fixtures/smallModel';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { MS_PER_HOUR, MS_PER_MINUTE } from '../domain';
import { CurrentChartEngine, type ChartEngineOptions } from './CurrentChartEngine';

const T0 = Date.UTC(2026, 8, 21, 2, 0, 0); // window start
const min = (m: number) => T0 + m * MS_PER_MINUTE;

// Stage 1000×440 with margins → plot 880×400. Window 180 min → 880/180 px per minute.
// Board offsets 3, 11, 19, 31 of 34 units → 400/34 px per unit.
const options: ChartEngineOptions = {
  board: smallBoard(),
  stage: { width: 1000, height: 440 },
  margins: { top: 20, right: 60, bottom: 20, left: 60 },
  window: { start: T0, end: T0 + 3 * MS_PER_HOUR },
  timeExtent: { start: T0 - 6 * MS_PER_HOUR, end: T0 + 3 * MS_PER_HOUR },
  now: min(120),
  config: DEFAULT_CHART_CONFIG,
};
const PX_PER_MIN = 880 / 180;
const PX_PER_UNIT = 400 / 34;

const engine = CurrentChartEngine.create(options);

describe('CurrentChartEngine — coordinates', () => {
  it('reports stage and plot bounds', () => {
    expect(engine.getChartBounds()).toEqual({
      stage: { width: 1000, height: 440 },
      plot: { x: 60, y: 20, width: 880, height: 400 },
    });
  });

  it('fits the initial window across the plot width', () => {
    expect(engine.timeToX(T0)).toBe(0);
    expect(engine.timeToX(min(180))).toBeCloseTo(880, 9);
    expect(engine.timeToX(min(45))).toBeCloseTo(45 * PX_PER_MIN, 9);
    expect(engine.getVisibleTimeRange()).toEqual(options.window);
  });

  it('inverts timeToX with xToTime', () => {
    expect(engine.xToTime(engine.timeToX(min(77.5)))).toBeCloseTo(min(77.5), 3);
  });

  it('places stations by layout offset, fitting the whole board in the plot height', () => {
    expect(engine.stationToY('1:AAA')).toBeCloseTo(3 * PX_PER_UNIT, 9);
    expect(engine.stationToY('2:DDD')).toBeCloseTo(31 * PX_PER_UNIT, 9);
    expect(engine.stationToY('9:NOPE')).toBeUndefined();
  });

  it('finds the nearest station to a y, optionally within a tolerance', () => {
    const yBBB = 11 * PX_PER_UNIT;
    expect(engine.yToStation(yBBB + 20)?.id).toBe('1:BBB');
    expect(engine.yToStation(yBBB + 20, 10)).toBeUndefined();
    expect(engine.yToStation(yBBB + 5, 10)?.id).toBe('1:BBB');
    expect(engine.yToStation(-500)?.id).toBe('1:AAA');
  });

  it('lists all stations as visible at fit zoom', () => {
    expect(engine.getVisibleStations().map((s) => s.station.code)).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
  });

  it('positions the current time', () => {
    expect(engine.getCurrentTimePosition()).toEqual({ x: 120 * PX_PER_MIN, visible: true });
    const later = CurrentChartEngine.create({ ...options, now: min(300) });
    expect(later.getCurrentTimePosition().visible).toBe(false);
  });
});

describe('CurrentChartEngine — zoom and pan', () => {
  it('zooms time about the anchor and narrows the visible range', () => {
    const anchorTime = engine.xToTime(440);
    const zoomed = engine.zoomAt({ x: 440, y: 200 }, 2);
    expect(zoomed.xToTime(440)).toBeCloseTo(anchorTime, 3);
    const { start, end } = zoomed.getVisibleTimeRange();
    expect((end - start) / MS_PER_MINUTE).toBeCloseTo(90, 6);
    // y untouched when factorY is 1
    expect(zoomed.stationToY('1:CCC')).toBeCloseTo(engine.stationToY('1:CCC') ?? NaN, 9);
  });

  it('is immutable', () => {
    engine.zoomAt({ x: 0, y: 0 }, 3).panBy(50, 50);
    expect(engine.getVisibleTimeRange()).toEqual(options.window);
  });

  it('cannot zoom out beyond the pannable extent', () => {
    const out = engine.zoomAt({ x: 440, y: 200 }, 0.01);
    expect(out.getVisibleTimeRange()).toEqual(options.timeExtent);
  });

  it('cannot zoom in beyond the max pixels per minute', () => {
    const deep = engine.zoomAt({ x: 440, y: 200 }, 1000);
    expect(deep.viewport.time.pxPerMinute).toBe(DEFAULT_CHART_CONFIG.zoomLimits.maxPxPerMinute);
  });

  it('pans in time and stops at the extent edges', () => {
    const panned = engine.panBy(100, 0);
    expect(panned.getVisibleTimeRange().start).toBeCloseTo(T0 - (100 / PX_PER_MIN) * MS_PER_MINUTE, 3);
    expect(engine.panBy(1e6, 0).getVisibleTimeRange().start).toBe(options.timeExtent.start);
    expect(engine.panBy(-1e6, 0).getVisibleTimeRange().end).toBeCloseTo(options.timeExtent.end, 3);
  });

  it('zooms stations about the anchor and scrolls within the board', () => {
    const yCCC = engine.stationToY('1:CCC') ?? NaN;
    const zoomed = engine.zoomAt({ x: 0, y: yCCC }, 1, 2);
    expect(zoomed.stationToY('1:CCC')).toBeCloseTo(yCCC, 9);
    expect(zoomed.viewport.pxPerUnit).toBeCloseTo(2 * PX_PER_UNIT, 9);
    expect(zoomed.getVisibleStations().length).toBeLessThan(4);

    // Can't scroll above the top or below the bottom.
    expect(zoomed.panBy(0, 1e6).viewport.scrollY).toBe(0);
    expect(zoomed.panBy(0, -1e6).viewport.scrollY).toBeCloseTo(34 * 2 * PX_PER_UNIT - 400, 6);
  });

  it('cannot zoom stations out below fit or beyond the max station zoom', () => {
    expect(engine.zoomAt({ x: 0, y: 0 }, 1, 0.1).viewport.pxPerUnit).toBeCloseTo(PX_PER_UNIT, 9);
    expect(engine.zoomAt({ x: 0, y: 0 }, 1, 100).viewport.pxPerUnit).toBeCloseTo(
      PX_PER_UNIT * DEFAULT_CHART_CONFIG.zoomLimits.maxStationZoom,
      9,
    );
  });

  it('keeps the visible time range on resize, stretching it to the new width', () => {
    const zoomed = engine.zoomAt({ x: 300, y: 200 }, 2);
    const resized = zoomed.resize({ width: 1500, height: 440 });
    expect(resized.getChartBounds().plot.width).toBe(1380);
    const before = zoomed.getVisibleTimeRange();
    const after = resized.getVisibleTimeRange();
    expect(after.start).toBeCloseTo(before.start, 3);
    expect(after.end).toBeCloseTo(before.end, 3);
  });

  it('keeps the vertical zoom and top station on resize', () => {
    const zoomed = engine.zoomAt({ x: 0, y: 200 }, 1, 2);
    const resized = zoomed.resize({ width: 1000, height: 640 }); // plot height 400 → 600
    expect(resized.viewport.pxPerUnit).toBeCloseTo(zoomed.viewport.pxPerUnit * 1.5, 9);
    expect(resized.yToStation(0)?.id).toBe(zoomed.yToStation(0)?.id);
    expect(resized.getVisibleStations().map((s) => s.station.id)).toEqual(
      zoomed.getVisibleStations().map((s) => s.station.id),
    );
  });

  it('fits a new window', () => {
    const window = { start: min(-60), end: min(0) };
    expect(engine.fitWindow(window).getVisibleTimeRange()).toEqual(window);
  });
});

describe('CurrentChartEngine — train geometry', () => {
  it('produces arrival/departure/through vertices in plot coordinates', () => {
    const t = train('T1', [
      event(1, 'AAA', { arrival: min(10), departure: min(12) }),
      event(2, 'BBB', { arrival: min(20), departure: min(20) }),
      event(3, 'CCC', { arrival: min(30) }),
    ]);
    const geometry = engine.getTrainGeometry(t);
    expect(geometry.points.map((p) => [p.kind, p.stationId])).toEqual([
      ['arrival', '1:AAA'],
      ['departure', '1:AAA'],
      ['through', '1:BBB'],
      ['arrival', '1:CCC'],
    ]);
    expect(geometry.points[0]?.x).toBeCloseTo(10 * PX_PER_MIN, 9);
    expect(geometry.points[3]?.y).toBeCloseTo(19 * PX_PER_UNIT, 9);
    expect(geometry.bounds?.x).toBeCloseTo(10 * PX_PER_MIN, 9);
    expect(geometry.bounds?.width).toBeCloseTo(20 * PX_PER_MIN, 9);
  });

  it('skips vertices at stations not on the board and events without times', () => {
    const t = train('T2', [
      event(1, 'AAA', { departure: min(10) }),
      event(2, 'ZZZ', { arrival: min(15), departure: min(16) }),
      event(3, 'BBB', {}),
    ]);
    expect(engine.getTrainGeometry(t).points.map((p) => p.stationId)).toEqual(['1:AAA']);
    expect(engine.getTrainGeometry(train('T3', [])).bounds).toBeUndefined();
  });

  it('offsets dwells in a lane > 0 by the lane offset, upwards for UP trains', () => {
    const dwell = (direction: 'UP' | 'DN') =>
      train('T9', [{ ...event(1, 'BBB', { arrival: min(10), departure: min(30) }), direction }]);
    const lanes = new Map([['T9#0', 2]]);
    const yBBB = engine.stationToY('1:BBB') ?? NaN;
    const offset = 2 * DEFAULT_CHART_CONFIG.dwellLanes.laneOffsetPx;
    expect(engine.getTrainGeometry(dwell('DN'), lanes).points.map((p) => p.y)).toEqual([
      yBBB + offset,
      yBBB + offset,
    ]);
    expect(engine.getTrainGeometry(dwell('UP'), lanes).points[0]?.y).toBeCloseTo(yBBB - offset, 9);
    expect(engine.getTrainGeometry(dwell('UP')).points[0]?.y).toBeCloseTo(yBBB, 9);
  });

  it('starts a forecast at the last actual vertex', () => {
    const t = {
      ...train('T1', [event(1, 'AAA', { departure: min(10) }), event(2, 'BBB', { arrival: min(20) })]),
      forecast: {
        kind: 'BASIC' as const,
        points: [
          { stationCode: 'BBB', sectionId: 1, departure: min(22) },
          { stationCode: 'CCC', sectionId: 1, arrival: min(35) },
        ],
      },
    };
    const geometry = engine.getForecastGeometry(t);
    expect(geometry.points.map((p) => [p.kind, p.stationId])).toEqual([
      ['arrival', '1:BBB'],
      ['forecast', '1:BBB'],
      ['forecast', '1:CCC'],
    ]);
    expect(engine.getForecastGeometry(train('none', [])).points).toEqual([]);
  });

  it('follows the viewport', () => {
    const t = train('T1', [event(1, 'AAA', { departure: min(60) })]);
    const zoomed = engine.zoomAt({ x: 0, y: 0 }, 2);
    expect(zoomed.getTrainGeometry(t).points[0]?.x).toBeCloseTo(60 * 2 * PX_PER_MIN, 9);
  });
});
