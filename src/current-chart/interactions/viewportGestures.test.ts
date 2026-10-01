import { smallBoard } from '../../tests/fixtures/smallModel';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { MS_PER_HOUR } from '../domain';
import { CurrentChartEngine } from '../engine';
import { viewportActionFor } from './viewportGestures';

const T0 = Date.UTC(2026, 8, 21, 2, 0, 0);
const engine = CurrentChartEngine.create({
  board: smallBoard(),
  stage: { width: 1000, height: 440 },
  margins: { top: 20, right: 60, bottom: 20, left: 60 },
  window: { start: T0, end: T0 + 3 * MS_PER_HOUR },
  timeExtent: { start: T0 - 6 * MS_PER_HOUR, end: T0 + 3 * MS_PER_HOUR },
  now: T0,
  config: DEFAULT_CHART_CONFIG,
});

const wheel = (x: number, y: number, deltaY: number, mods: { ctrlKey?: boolean; shiftKey?: boolean } = {}) =>
  ({ type: 'wheel', x, y, deltaX: 0, deltaY, ctrlKey: false, shiftKey: false, ...mods }) as const;

function engineOf(action: ReturnType<typeof viewportActionFor>): CurrentChartEngine {
  if (action.kind !== 'engine') throw new Error(`expected engine action, got ${action.kind}`);
  return action.engine;
}

describe('viewportActionFor', () => {
  it('wheel up over the plot zooms time in about the pointer, leaving stations alone', () => {
    const anchorTime = engine.xToTime(300 - 60);
    const next = engineOf(viewportActionFor(wheel(300, 200, -100), engine));
    expect(next.viewport.time.pxPerMinute).toBeGreaterThan(engine.viewport.time.pxPerMinute);
    expect(next.xToTime(300 - 60)).toBeCloseTo(anchorTime, 3);
    expect(next.viewport.pxPerUnit).toBe(engine.viewport.pxPerUnit);
  });

  it('wheel down zooms time out', () => {
    const zoomedIn = engine.zoomAt({ x: 400, y: 0 }, 3);
    const next = engineOf(viewportActionFor(wheel(400, 200, 100), zoomedIn));
    expect(next.viewport.time.pxPerMinute).toBeLessThan(zoomedIn.viewport.time.pxPerMinute);
  });

  it('wheel over the station columns zooms stations', () => {
    const next = engineOf(viewportActionFor(wheel(20, 200, -100), engine));
    expect(next.viewport.pxPerUnit).toBeGreaterThan(engine.viewport.pxPerUnit);
    expect(next.viewport.time).toEqual(engine.viewport.time);
  });

  it('ctrl+wheel zooms stations anywhere', () => {
    const next = engineOf(viewportActionFor(wheel(500, 200, -100, { ctrlKey: true }), engine));
    expect(next.viewport.pxPerUnit).toBeGreaterThan(engine.viewport.pxPerUnit);
  });

  it('shift+wheel pans time', () => {
    const next = engineOf(viewportActionFor(wheel(500, 200, 100, { shiftKey: true }), engine));
    expect(next.viewport.time.pxPerMinute).toBe(engine.viewport.time.pxPerMinute);
    expect(next.viewport.time.start).toBeGreaterThan(engine.viewport.time.start - 1); // clamped at extent end
    const back = engineOf(viewportActionFor(wheel(500, 200, -100, { shiftKey: true }), engine));
    expect(back.viewport.time.start).toBeLessThan(engine.viewport.time.start);
  });

  it('a horizontal trackpad swipe pans time', () => {
    const next = engineOf(
      viewportActionFor(
        { type: 'wheel', x: 500, y: 200, deltaX: -50, deltaY: 2, ctrlKey: false, shiftKey: false },
        engine,
      ),
    );
    expect(next.viewport.time.start).toBeLessThan(engine.viewport.time.start);
  });

  it('drag pans', () => {
    const next = engineOf(viewportActionFor({ type: 'drag', dx: 50, dy: 0 }, engine));
    expect(next.viewport.time.start).toBeLessThan(engine.viewport.time.start);
  });

  it('double-click resets; pointer moves do nothing', () => {
    expect(viewportActionFor({ type: 'doubleClick', x: 1, y: 1 }, engine)).toEqual({ kind: 'reset' });
    expect(viewportActionFor({ type: 'pointerMove', x: 1, y: 1 }, engine)).toEqual({ kind: 'none' });
  });
});
