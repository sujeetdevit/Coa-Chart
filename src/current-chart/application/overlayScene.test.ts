import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { normalizeSnapshot, parseCoaDateTime } from '../adapters';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { DEFAULT_CHART_THEME, withColumnWidths } from '../configuration/chartTheme';
import { CurrentChartEngine } from '../engine';
import { grabX } from '../interactions/columnResize';
import { buildInfrastructureLayer } from '../rendering/build/buildInfrastructureLayer';
import { buildOverlayScene, overlayAt } from './overlayScene';
import { initialTimeWindow, pannableTimeExtent } from './timeWindow';

const ist = (text: string) => parseCoaDateTime(text) ?? NaN;

// Expected counts computed independently from the JSON (Python), at now = 21-09 00:25.
describe('overlay scene with the supplied data', () => {
  const model = normalizeSnapshot(loadSuppliedSnapshot());
  const window = initialTimeWindow(model.asOf, DEFAULT_CHART_CONFIG);
  const engine = CurrentChartEngine.create({
    board: model.board,
    stage: { width: 1800, height: 1000 },
    margins: DEFAULT_CHART_THEME.margins,
    window,
    timeExtent: pannableTimeExtent(model, window, DEFAULT_CHART_CONFIG),
    now: model.asOf,
    config: DEFAULT_CHART_CONFIG,
  });
  const scene = buildOverlayScene(engine, model, DEFAULT_CHART_THEME, model.asOf);
  const { plot } = engine.getChartBounds();

  it('places the three blocks that overlap the opening window, inside the plot rows of their stations', () => {
    expect(scene.blocks.map((b) => b.block.id).sort()).toEqual(['DLI09264962', 'DLI09264963', 'DLI09264964']);
    for (const shape of scene.blocks) {
      expect(shape.x0).toBeCloseTo(plot.x + engine.timeToX(ist('20-09-26 22:30:00')), 6);
      expect(shape.burst).toBeUndefined(); // these end exactly at their permitted end
      expect(shape.astX).toBeCloseTo(shape.x0, 6);
    }
  });

  it('shows one caution icon per group in force (18 groups of 37 cautions)', () => {
    expect(scene.cautions).toHaveLength(18);
    expect(scene.cautions.reduce((n, c) => n + c.group.cautions.length, 0)).toBe(37);
    for (const icon of scene.cautions) {
      expect(icon.cx).toBeGreaterThanOrEqual(scene.columns.caution.x);
      expect(icon.cx).toBeLessThanOrEqual(scene.columns.caution.x + scene.columns.caution.width);
    }
  });

  it('shows a box for every station line, 30 of them occupied', () => {
    expect(scene.occupancy).toHaveLength(146);
    expect(scene.occupancy.filter((b) => b.state === 'OCCUPIED')).toHaveLength(30);
  });

  it('has no remarks in the opening window, and no unusual or chart remarks without data', () => {
    expect(scene.remarks).toEqual([]);
    expect(scene.unusual).toEqual([]);
    expect(scene.chartRemarks).toEqual([]);
  });

  it('finds tooltips by position: icons first, blocks underneath', () => {
    const icon = scene.cautions[0];
    if (!icon) throw new Error('no caution');
    expect(overlayAt(scene.topHits, icon.cx, icon.cy)?.tooltip.title).toMatch(/^Caution /);
    const block = scene.blocks[0];
    if (!block) throw new Error('no block');
    const hit = overlayAt(
      scene.bottomHits,
      (block.x0 + Math.min(block.x1, plot.x + plot.width)) / 2,
      (block.y0 + block.y1) / 2,
    );
    expect(hit?.tooltip.title).toMatch(/^Block /);
  });

  it('renders blocks in their department colour with AST/AET lines', () => {
    const groups = buildInfrastructureLayer(scene, engine, DEFAULT_CHART_THEME);
    const items = groups.flatMap((g) => g.items);
    const shape = scene.blocks[0];
    if (!shape) throw new Error('no block');
    expect(items.find((p) => p.id === `${shape.id}:ast`)).toMatchObject({
      stroke: DEFAULT_CHART_THEME.overlays.blockAst,
    });
    expect(items.find((p) => p.id === `${shape.id}:aet`)).toMatchObject({
      stroke: DEFAULT_CHART_THEME.overlays.blockAet,
    });
    expect(items.filter((p) => p.id.endsWith(':icon'))).toHaveLength(18);
  });
});

describe('overlay scene with side columns narrowed or hidden', () => {
  const model = normalizeSnapshot(loadSuppliedSnapshot());
  const window = initialTimeWindow(model.asOf, DEFAULT_CHART_CONFIG);
  const full = CurrentChartEngine.create({
    board: model.board,
    stage: { width: 1800, height: 1000 },
    margins: DEFAULT_CHART_THEME.margins,
    window,
    timeExtent: pannableTimeExtent(model, window, DEFAULT_CHART_CONFIG),
    now: model.asOf,
    config: DEFAULT_CHART_CONFIG,
  });
  const sceneFor = (widths: { caution: number; occupancy: number }) => {
    const theme = withColumnWidths(DEFAULT_CHART_THEME, widths);
    const engine = full.withMargins(theme.margins);
    const scene = buildOverlayScene(engine, model, theme, model.asOf);
    return { theme, engine, scene, groups: buildInfrastructureLayer(scene, engine, theme) };
  };
  const { cautionColumn, occupancyColumn } = DEFAULT_CHART_THEME.layout;
  const ids = (groups: ReturnType<typeof sceneFor>['groups']) =>
    groups.flatMap((g) => g.items.map((i) => i.id));

  it('gives the width of hidden columns to the plot', () => {
    const { engine, scene } = sceneFor({ caution: 0, occupancy: 0 });
    expect(engine.getChartBounds().plot.width).toBe(
      full.getChartBounds().plot.width + cautionColumn + occupancyColumn,
    );
    expect(scene.columns.caution.width).toBe(0);
    expect(scene.columns.occupancy.x).toBe(1800);
  });

  it('shows no caution icons, tooltips or title when the caution column is hidden, and keeps the line boxes', () => {
    const { scene, groups } = sceneFor({ caution: 0, occupancy: occupancyColumn });
    expect(scene.cautions).toEqual([]);
    expect(scene.topHits.some((h) => h.id.startsWith('ctn:'))).toBe(false);
    expect(scene.occupancy).toHaveLength(146);
    expect(ids(groups)).not.toContain('panel-title:caution');
    expect(ids(groups)).toContain('panel-title:occupancy');
  });

  it('shows no line boxes when the line column is hidden, and keeps the cautions', () => {
    const { scene, groups } = sceneFor({ caution: cautionColumn, occupancy: 0 });
    expect(scene.occupancy).toEqual([]);
    expect(scene.topHits.some((h) => h.id.startsWith('occ:'))).toBe(false);
    expect(scene.cautions).toHaveLength(18);
    expect(ids(groups)).not.toContain('panel-title:occupancy');
  });

  it('keeps only what fits in a narrowed column', () => {
    const { scene } = sceneFor({ caution: 28, occupancy: 6 + 4 * 20 });
    // One caution slot is 28 px: rows with two or three icons keep the first.
    expect(scene.cautions.length).toBeGreaterThan(0);
    expect(scene.cautions.length).toBeLessThan(18);
    expect(new Set(scene.cautions.map((c) => c.cx)).size).toBe(1);
    // Four boxes per row fit: stations with more lines lose the rest.
    expect(scene.occupancy.length).toBeLessThan(146);
    const right = scene.columns.occupancy.x + scene.columns.occupancy.width;
    for (const box of scene.occupancy) expect(box.x + box.width).toBeLessThanOrEqual(right);
  });

  it('clips caution captions so they never run over the line boxes', () => {
    const { scene, groups } = sceneFor({ caution: 28, occupancy: occupancyColumn });
    const clip = groups.find((g) => g.id === 'caution-items')?.clip;
    expect(clip?.x).toBe(scene.columns.caution.x);
    expect((clip?.x ?? 0) + (clip?.width ?? 0)).toBe(scene.columns.occupancy.x);
  });

  it('draws a splitter on each movable edge, reachable even when the last column is hidden', () => {
    const { scene, groups, theme } = sceneFor({ caution: 0, occupancy: 0 });
    const grip = (key: string) => {
      const item = groups.flatMap((g) => g.items).find((i) => i.id === `splitter-handle:${key}`);
      if (item?.kind !== 'rect') throw new Error(`no grip for ${key}`);
      return item;
    };
    expect(grip('caution').x + grip('caution').width / 2).toBe(grabX(scene.columns.caution.x, 1800));
    // At the stage border the handle is nudged 1 px in so it is not cut off.
    expect(grip('occupancy').x + grip('occupancy').width / 2).toBe(grabX(1800, 1800) - 1);
    expect(grip('occupancy').x + grip('occupancy').width).toBeLessThanOrEqual(1800);
    expect(grip('caution').fill).toBe(theme.layout.splitter.handle);
    // The bar runs the full height and is drawn above the column contents.
    const bar = groups.at(-1)?.items.find((i) => i.id === 'splitter-bar:caution');
    expect(bar).toMatchObject({ y: 0, height: 1000, fill: theme.layout.splitter.bar });
  });

  it('highlights the splitter under the pointer', () => {
    const { scene, engine, theme } = sceneFor({ caution: cautionColumn, occupancy: occupancyColumn });
    const items = buildInfrastructureLayer(scene, engine, theme, 'occupancy').flatMap((g) => g.items);
    const fill = (id: string) => items.find((i) => i.id === id && i.kind === 'rect');
    expect(fill('splitter-handle:occupancy')).toMatchObject({ fill: theme.layout.splitter.activeHandle });
    expect(fill('splitter-bar:occupancy')).toMatchObject({ fill: theme.layout.splitter.activeBar });
    expect(fill('splitter-handle:caution')).toMatchObject({ fill: theme.layout.splitter.handle });
  });

  it('leaves the full-width layout as it was', () => {
    const { scene, engine } = sceneFor({ caution: cautionColumn, occupancy: occupancyColumn });
    expect(engine.getChartBounds()).toEqual(full.getChartBounds());
    expect(scene.cautions).toHaveLength(18);
    expect(scene.occupancy).toHaveLength(146);
  });
});
