import { MSG_HEIGHT, MSG_WIDTH, type OverlayScene } from '../../application/overlayScene';
import { departmentKey, type ChartTheme } from '../../configuration/chartTheme';
import type { CurrentChartEngine } from '../../engine';
import { grabX, RESIZABLE_COLUMNS, type ResizableColumn } from '../../interactions/columnResize';
import type { Primitive, PrimitiveGroup } from '../types';

const MIN_TITLE_WIDTH = 30;
/** Group holding the drag splitters: screen-only, left out of pictures of the chart. */
export const SPLITTER_GROUP = 'column-splitters';

function star(cx: number, cy: number, r: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  return points;
}

function triangle(cx: number, cy: number, r: number, up: boolean): number[] {
  const s = up ? 1 : -1;
  return [cx, cy - s * r, cx + r, cy + s * r * 0.8, cx - r, cy + s * r * 0.8];
}

/**
 * Blocks in the plot, and the right-hand columns: caution icons, unusual icons and line
 * occupancy boxes (manual §11.1 and its chart screenshots).
 */
export function buildInfrastructureLayer(
  scene: OverlayScene,
  engine: CurrentChartEngine,
  theme: ChartTheme,
  /** The splitter under the pointer or being dragged, drawn highlighted. */
  activeColumn?: ResizableColumn,
): PrimitiveGroup[] {
  const { plot, stage } = engine.getChartBounds();
  const o = theme.overlays;
  const plotClip = { x: plot.x, y: plot.y, width: plot.width, height: plot.height };

  // ── blocks ──
  const blocks: Primitive[] = [];
  for (const shape of scene.blocks) {
    const colour = o.blockDepartments[departmentKey(shape.block.department)] ?? o.blockDefault;
    const width = Math.max(1, shape.x1 - shape.x0);
    const height = Math.max(1, shape.y1 - shape.y0);
    if (shape.period.permittedOnly) {
      // Not started: outline of the permitted window only.
      blocks.push({
        kind: 'line',
        id: `${shape.id}:permitted`,
        points: [shape.x0, shape.y0, shape.x1, shape.y0, shape.x1, shape.y1, shape.x0, shape.y1],
        closed: true,
        stroke: colour,
        strokeWidth: 1,
        dash: [4, 3],
      });
    } else {
      blocks.push({
        kind: 'rect',
        id: `${shape.id}:body`,
        x: shape.x0,
        y: shape.y0,
        width,
        height,
        fill: colour,
        opacity: o.blockFillOpacity,
      });
      if (shape.burst) {
        blocks.push({
          kind: 'rect',
          id: `${shape.id}:burst`,
          x: shape.burst.x0,
          y: shape.y0,
          width: Math.max(1, shape.burst.x1 - shape.burst.x0),
          height,
          fill: o.blockBurst,
          opacity: o.blockBurstOpacity,
        });
      }
      blocks.push({
        kind: 'line',
        id: `${shape.id}:edge`,
        points: [shape.x0, shape.y0, shape.x1, shape.y0, shape.x1, shape.y1, shape.x0, shape.y1],
        closed: true,
        stroke: colour,
        strokeWidth: 1,
      });
    }
    for (const [key, x, stroke] of [
      ['ast', shape.astX, o.blockAst],
      ['aet', shape.aetX, o.blockAet],
    ] as const) {
      if (x === undefined) continue;
      blocks.push({
        kind: 'line',
        id: `${shape.id}:${key}`,
        points: [x, shape.y0, x, shape.y1],
        stroke,
        strokeWidth: o.blockEdgeWidth,
      });
    }
    blocks.push({
      kind: 'text',
      id: `${shape.id}:reason`,
      text: shape.block.reason,
      x: Math.max(shape.x0, plot.x) + 3,
      y: shape.y0 + 2,
      align: 'left',
      baseline: 'top',
      fill: o.blockReason,
      fontSize: o.blockReasonSize,
      fontFamily: theme.fontFamily,
    });
  }

  // ── column panels ──
  const panels: Primitive[] = [];
  const headers: [string, keyof OverlayScene['columns']][] = [
    ['Caution', 'caution'],
    ['U', 'unusual'],
    ['Line', 'occupancy'],
  ];
  for (const [title, key] of headers) {
    const col = scene.columns[key];
    panels.push(
      {
        kind: 'rect',
        id: `panel:${key}`,
        x: col.x,
        y: 0,
        width: col.width,
        height: stage.height,
        fill: theme.layout.panelBackground,
      },
      {
        kind: 'line',
        id: `panel-div:${key}`,
        points: [col.x, 0, col.x, stage.height],
        stroke: theme.layout.panelDivider,
        strokeWidth: 1,
      },
    );
    // No room for a title on a hidden or very narrow column.
    if (col.width >= MIN_TITLE_WIDTH) {
      panels.push({
        kind: 'text',
        id: `panel-title:${key}`,
        text: title,
        x: col.x + col.width / 2,
        y: plot.y - 4,
        align: 'center',
        baseline: 'bottom',
        fill: '#555555',
        fontSize: 10,
        fontFamily: theme.fontFamily,
      });
    }
  }
  // Splitters on the edges that can be dragged to narrow or hide a column: a full-height bar
  // with a handle block in the middle, so it reads as something to grab.
  const splitters: Primitive[] = [];
  const sp = theme.layout.splitter;
  for (const key of RESIZABLE_COLUMNS) {
    const x = grabX(scene.columns[key].x, stage.width);
    const active = key === activeColumn;
    const handleY = plot.y + (plot.height - sp.handleHeight) / 2;
    const marks: number[] = [];
    for (const dy of [-6, 0, 6]) {
      const y = handleY + sp.handleHeight / 2 + dy;
      marks.push(x - 2, y, x + 2, y);
    }
    splitters.push(
      {
        kind: 'rect',
        id: `splitter-bar:${key}`,
        x: x - sp.barWidth / 2,
        y: 0,
        width: sp.barWidth,
        height: stage.height,
        fill: active ? sp.activeBar : sp.bar,
      },
      {
        kind: 'rect',
        id: `splitter-handle:${key}`,
        x: Math.min(x - sp.handleWidth / 2, stage.width - sp.handleWidth),
        y: handleY,
        width: sp.handleWidth,
        height: sp.handleHeight,
        fill: active ? sp.activeHandle : sp.handle,
      },
      {
        kind: 'segments',
        id: `splitter-marks:${key}`,
        points: marks,
        stroke: sp.handleMark,
        strokeWidth: 1.5,
      },
    );
  }

  // ── icons and boxes, clipped to the plot's vertical range ──
  const cautionIcons: Primitive[] = [];
  const icons: Primitive[] = [];
  const r = o.cautionIconSize / 2;
  for (const icon of scene.cautions) {
    const { direction } = icon.group;
    cautionIcons.push({
      kind: 'line',
      id: `${icon.id}:icon`,
      points:
        direction === 'BOTH'
          ? star(icon.cx, icon.cy, r + 1)
          : triangle(icon.cx, icon.cy, r, direction === 'UP'),
      closed: true,
      fill: direction === 'BOTH' ? o.cautionBoth : direction === 'UP' ? o.cautionUp : o.cautionDown,
      stroke: '#ffffff',
      strokeWidth: 0.5,
    });
    if (icon.text) {
      cautionIcons.push({
        kind: 'text',
        id: `${icon.id}:text`,
        text: icon.text,
        x: icon.cx,
        y: icon.cy - r - 1,
        align: 'center',
        baseline: 'bottom',
        fill: o.cautionText,
        fontSize: o.cautionTextSize,
        fontFamily: theme.fontFamily,
      });
    }
  }
  const s = o.unusualIconSize;
  for (const icon of scene.unusual) {
    icons.push({
      kind: 'rect',
      id: `${icon.id}:icon`,
      x: icon.cx - s / 2,
      y: icon.cy - s / 2,
      width: s,
      height: s,
      fill: o.unusual[icon.occurrence.type] ?? o.unusualDefault,
    });
  }
  for (const box of scene.occupancy) {
    icons.push(
      {
        kind: 'rect',
        id: `${box.id}:box`,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: box.state === 'OCCUPIED' ? o.occupied : o.free,
      },
      {
        kind: 'text',
        id: `${box.id}:code`,
        text: box.code,
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        align: 'center',
        baseline: 'middle',
        fill: o.occupancyText,
        fontSize: o.occupancyTextSize,
        fontFamily: theme.fontFamily,
      },
    );
  }

  const columnsClip = {
    x: scene.columns.caution.x,
    y: plot.y - 14,
    width: stage.width - scene.columns.caution.x,
    height: plot.height + 28,
  };
  // Caution captions are wider than their icon: they may run into the narrow "U" column, as on
  // the full-width layout, but never over the line boxes.
  const cautionClip = { ...columnsClip, width: scene.columns.occupancy.x - scene.columns.caution.x };
  return [
    { id: 'blocks', clip: plotClip, items: blocks },
    { id: 'panels', items: panels },
    { id: 'caution-items', clip: cautionClip, items: cautionIcons },
    { id: 'column-items', clip: columnsClip, items: icons },
    { id: SPLITTER_GROUP, items: splitters },
  ];
}

/** Train remark markers and chart (user) remarks, drawn above the trains. */
export function buildAnnotationGroups(
  scene: OverlayScene,
  engine: CurrentChartEngine,
  theme: ChartTheme,
): PrimitiveGroup[] {
  const { plot } = engine.getChartBounds();
  const o = theme.overlays;
  const items: Primitive[] = [];
  for (const marker of scene.remarks) {
    items.push(
      {
        kind: 'rect',
        id: `${marker.id}:box`,
        x: marker.x - 5,
        y: marker.y - 5,
        width: 10,
        height: 10,
        fill: o.remarkMarker,
      },
      {
        kind: 'text',
        id: `${marker.id}:r`,
        text: 'R',
        x: marker.x,
        y: marker.y,
        align: 'center',
        baseline: 'middle',
        fill: o.remarkMarkerText,
        fontSize: 8,
        fontFamily: theme.fontFamily,
        bold: true,
      },
    );
  }
  for (const msg of scene.messages) {
    items.push(
      {
        kind: 'rect',
        id: `${msg.id}:box`,
        x: msg.x - MSG_WIDTH / 2,
        y: msg.y - MSG_HEIGHT / 2,
        width: MSG_WIDTH,
        height: MSG_HEIGHT,
        fill: '#ffffff',
        stroke: o.messageMarker,
        strokeWidth: 1.5,
      },
      {
        kind: 'text',
        id: `${msg.id}:text`,
        text: 'MSG',
        x: msg.x,
        y: msg.y,
        align: 'center',
        baseline: 'middle',
        fill: o.messageMarker,
        fontSize: 9,
        fontFamily: theme.fontFamily,
        bold: true,
      },
    );
  }
  for (const text of scene.chartRemarks) {
    items.push({
      kind: 'text',
      id: text.id,
      text: text.remark.text,
      x: text.x,
      y: text.y,
      align: 'left',
      baseline: 'bottom',
      fill: o.chartRemark,
      fontSize: o.chartRemarkSize,
      fontFamily: theme.fontFamily,
    });
  }
  return [
    { id: 'annotations', clip: { x: plot.x, y: plot.y, width: plot.width, height: plot.height }, items },
  ];
}
