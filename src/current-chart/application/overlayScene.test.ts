import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { normalizeSnapshot, parseCoaDateTime } from '../adapters';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { DEFAULT_CHART_THEME, withColumnWidths } from '../configuration/chartTheme';
import { CurrentChartEngine } from '../engine';
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

describe('overlay scene with side columns switched off', () => {
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
  const sceneFor = (widths: { caution: number; occupancy: number; unusual?: number }) => {
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

  it('clips caution captions so they never run over the line boxes', () => {
    const { scene, groups } = sceneFor({ caution: cautionColumn, occupancy: occupancyColumn });
    const clip = groups.find((g) => g.id === 'caution-items')?.clip;
    expect(clip?.x).toBe(scene.columns.caution.x);
    expect((clip?.x ?? 0) + (clip?.width ?? 0)).toBe(scene.columns.occupancy.x);
  });

  it('hides the unusual column too, leaving only stations and distances on the right', () => {
    const { unusualColumn, stationColumn } = DEFAULT_CHART_THEME.layout;
    const { engine, scene, groups } = sceneFor({ caution: 0, occupancy: 0, unusual: 0 });
    const { plot } = engine.getChartBounds();
    expect(plot.width).toBe(
      full.getChartBounds().plot.width + cautionColumn + occupancyColumn + unusualColumn,
    );
    expect(plot.x + plot.width + stationColumn).toBe(1800);
    expect(scene.columns.unusual.width).toBe(0);
    expect(scene.unusual).toEqual([]);
    expect(ids(groups)).not.toContain('panel-title:unusual');

    // Hidden on its own, the other two keep their contents.
    const only = sceneFor({ caution: cautionColumn, occupancy: occupancyColumn, unusual: 0 });
    expect(only.scene.cautions).toHaveLength(18);
    expect(only.scene.occupancy).toHaveLength(146);
    expect(ids(only.groups)).toContain('panel-title:caution');
  });

  it('draws no drag handles', () => {
    const { groups } = sceneFor({ caution: 0, occupancy: 0 });
    expect(groups.map((g) => g.id)).toEqual(['blocks', 'panels', 'caution-items', 'column-items']);
    expect(ids(groups).some((id) => id.startsWith('splitter'))).toBe(false);
  });

  it('leaves the full-width layout as it was', () => {
    const { scene, engine } = sceneFor({ caution: cautionColumn, occupancy: occupancyColumn });
    expect(engine.getChartBounds()).toEqual(full.getChartBounds());
    expect(scene.cautions).toHaveLength(18);
    expect(scene.occupancy).toHaveLength(146);
  });
});
