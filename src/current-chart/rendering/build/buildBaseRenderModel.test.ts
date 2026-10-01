import { boardRow, smallSnapshot } from '../../../tests/fixtures/rawRows';
import { normalizeSnapshot, parseCoaDateTime } from '../../adapters';
import { DEFAULT_CHART_CONFIG } from '../../configuration/chartConfig';
import { DEFAULT_CHART_THEME as theme } from '../../configuration/chartTheme';
import { MS_PER_HOUR } from '../../domain';
import { CurrentChartEngine } from '../../engine';
import type { ChartRenderModel, LinePrimitive, Primitive } from '../types';
import { buildBaseRenderModel } from './buildBaseRenderModel';

const ist = (text: string) => parseCoaDateTime(text) ?? NaN;

const board = normalizeSnapshot(
  smallSnapshot({
    boardDetails: [
      boardRow('AAA', 1, 1),
      boardRow('BBB', 1, 2),
      boardRow('SDG', 1, 3, { MACCLASSFLAG: 'S' }),
      boardRow('CCC', 1, 4),
    ],
  }),
).board;

const start = ist('21-09-26 06:00:00');
const engine = CurrentChartEngine.create({
  board,
  stage: { width: 1000, height: 400 },
  margins: theme.margins,
  window: { start, end: start + 2 * MS_PER_HOUR },
  timeExtent: { start: start - 6 * MS_PER_HOUR, end: start + 2 * MS_PER_HOUR },
  now: ist('21-09-26 07:30:00'),
  config: DEFAULT_CHART_CONFIG,
});

function all(model: ChartRenderModel): Primitive[] {
  return Object.values(model.layers).flatMap((groups) => groups.flatMap((g) => g.items));
}
function byId<K extends Primitive['kind']>(
  model: ChartRenderModel,
  id: string,
  kind: K,
): Extract<Primitive, { kind: K }> {
  const item = all(model).find((p) => p.id === id);
  if (item?.kind !== kind) throw new Error(`missing ${kind} ${id}`);
  return item as Extract<Primitive, { kind: K }>;
}

describe('buildBaseRenderModel', () => {
  const model = buildBaseRenderModel(engine, theme);
  const { plot } = engine.getChartBounds();

  it('sizes the model to the stage and clips the plot', () => {
    expect([model.width, model.height]).toEqual([1000, 400]);
    expect(model.layers.background[0]?.clip).toEqual(plot);
  });

  it('shades the plot from its left edge up to now', () => {
    const shading = byId(model, 'past-shading', 'rect');
    expect(shading.x).toBe(plot.x);
    expect(shading.width).toBeCloseTo(engine.timeToX(ist('21-09-26 07:30:00')), 6);
    expect(shading.fill).toBe(theme.pastShading);
  });

  it('omits shading when now is before the visible window', () => {
    const earlier = engine
      .panBy(-1e6, 0)
      .fitWindow({ start: ist('21-09-26 07:40:00'), end: ist('21-09-26 08:00:00') });
    expect(all(buildBaseRenderModel(earlier, theme)).some((p) => p.id === 'past-shading')).toBe(false);
  });

  it('draws a 10-minute grid with darker hour lines', () => {
    const grid = all(model).filter((p): p is LinePrimitive => p.id.startsWith('grid-t:'));
    expect(grid).toHaveLength(13); // 06:00 … 08:00
    const hour = byId(model, `grid-t:${ist('21-09-26 07:00:00')}`, 'line');
    const minute = byId(model, `grid-t:${ist('21-09-26 07:10:00')}`, 'line');
    expect(hour.stroke).toBe(theme.timeAxis.hourLine);
    expect(minute.stroke).toBe(theme.timeAxis.minuteLine);
    expect(hour.points).toEqual([
      plot.x + engine.timeToX(ist('21-09-26 07:00:00')),
      plot.y,
      hour.points[2],
      plot.y + plot.height,
    ]);
  });

  it('labels hours red and minutes black, top and bottom', () => {
    const hourTop = byId(model, `tl-top:${ist('21-09-26 07:00:00')}`, 'text');
    const minuteBottom = byId(model, `tl-bottom:${ist('21-09-26 07:10:00')}`, 'text');
    expect([hourTop.text, hourTop.fill, hourTop.baseline]).toEqual(['7', theme.timeAxis.hourLabel, 'bottom']);
    expect([minuteBottom.text, minuteBottom.fill, minuteBottom.baseline]).toEqual([
      '10',
      theme.timeAxis.minuteLabel,
      'top',
    ]);
  });

  it('labels stations on both sides: boundaries blue, sidings red, others black', () => {
    const color = (code: string) => byId(model, `sl-left:1:${code}`, 'text').fill;
    expect(color('AAA')).toBe(theme.stationAxis.boundaryLabel);
    expect(color('BBB')).toBe(theme.stationAxis.label);
    expect(color('SDG')).toBe(theme.stationAxis.sidingLabel);
    expect(color('CCC')).toBe(theme.stationAxis.boundaryLabel); // last running station
    const right = byId(model, 'sl-right:1:BBB', 'text');
    expect(right.align).toBe('left');
    expect(right.y).toBeCloseTo(plot.y + (engine.stationToY('1:BBB') ?? NaN), 6);
    expect(byId(model, 'sl-km:1:BBB', 'text').text).toBe('80');
  });

  it('draws a dotted line per visible station', () => {
    const line = byId(model, 'grid-s:1:CCC', 'line');
    expect(line.dash).toEqual(theme.stationAxis.lineDash);
  });

  it('only includes stations near the visible plot when zoomed in vertically', () => {
    const zoomed = engine.zoomAt({ x: 0, y: 0 }, 1, 8);
    const labels = all(buildBaseRenderModel(zoomed, theme)).filter((p) => p.id.startsWith('sl-left:'));
    expect(labels.map((p) => p.id)).toEqual(['sl-left:1:AAA']);
  });

  it('keeps ids stable across a pan so nodes can be reused', () => {
    const panned = buildBaseRenderModel(engine.panBy(-3, 0), theme);
    const ids = (m: ChartRenderModel) => new Set(all(m).map((p) => p.id));
    const before = ids(model);
    const shared = [...ids(panned)].filter((id) => before.has(id));
    expect(shared.length).toBeGreaterThan(before.size * 0.9);
  });
});
