import type { TrainScene, TrainSceneItem } from '../../application/trainScene';
import type { ChartTheme } from '../../configuration/chartTheme';
import type { CurrentChartEngine, Rect } from '../../engine';
import type { Primitive, PrimitiveGroup } from '../types';

export interface ChartHover {
  trainId: string;
  /** Hovered vertex of the actual path, if the pointer is on a point rather than a line. */
  pointIndex?: number;
  /** Hovered segment of the actual path (points[i] → points[i + 1]), for MSM. */
  segmentIndex?: number;
  /** Hovered vertex of the forecast path (manual forecast dragging). */
  forecastPointIndex?: number;
}

export interface InteractionState {
  hover?: ChartHover;
  selectedTrainId?: string;
  /** Hovered overlay item (block, icon, box, remark, MSG), in stage coordinates. */
  overlayRect?: Rect;
  /** Box-zoom selection being dragged, in stage coordinates. */
  selectionRect?: Rect;
}

function halo(
  item: TrainSceneItem,
  key: string,
  ox: number,
  oy: number,
  width: number,
  opacity: number,
): Primitive[] {
  const out: Primitive[] = [];
  for (const [name, geometry] of [
    ['a', item.actual],
    ['f', item.forecast],
  ] as const) {
    if (geometry.points.length < 2) continue;
    out.push({
      kind: 'line',
      id: `${key}-${name}:${item.train.id}`,
      points: geometry.points.flatMap((p) => [p.x + ox, p.y + oy]),
      stroke: item.train.colour,
      strokeWidth: width,
      opacity,
      lineCap: 'round',
      lineJoin: 'round',
    });
  }
  return out;
}

/** Selection, hover and box-zoom feedback. Rebuilt on pointer movement; everything else stays cached. */
export function buildInteractionLayer(
  scene: TrainScene,
  engine: CurrentChartEngine,
  theme: ChartTheme,
  state: InteractionState,
): PrimitiveGroup[] {
  const { plot } = engine.getChartBounds();
  const ox = plot.x;
  const oy = plot.y;
  const t = theme.interaction;
  const { hover } = state;
  const items: Primitive[] = [];

  const selected = state.selectedTrainId ? scene.byId.get(state.selectedTrainId) : undefined;
  if (selected) items.push(...halo(selected, 'sel', ox, oy, t.selectedWidth, t.selectedOpacity));

  const hovered = hover ? scene.byId.get(hover.trainId) : undefined;
  if (hovered && hovered !== selected) {
    items.push(...halo(hovered, 'hov', ox, oy, t.hoverWidth, t.hoverOpacity));
  }

  const point =
    hover?.forecastPointIndex !== undefined
      ? hovered?.forecast.points[hover.forecastPointIndex]
      : hover?.pointIndex !== undefined
        ? hovered?.actual.points[hover.pointIndex]
        : undefined;
  if (hovered && point) {
    items.push({
      kind: 'circle',
      id: 'hov-point',
      x: point.x + ox,
      y: point.y + oy,
      radius: theme.movement.pointRadius + 3,
      stroke: hovered.train.colour,
      strokeWidth: 1.5,
    });
  }

  const outline: Primitive[] = [];
  const rect = (id: string, r: Rect, fill: string) =>
    outline.push({
      kind: 'rect',
      id,
      x: r.x - 1,
      y: r.y - 1,
      width: r.width + 2,
      height: r.height + 2,
      fill,
      stroke: t.overlayOutline,
      strokeWidth: 1.5,
    });
  if (state.overlayRect) rect('hov-overlay', state.overlayRect, 'transparent');
  if (state.selectionRect) rect('zoom-box', state.selectionRect, 'rgba(26,115,232,0.08)');

  return [
    { id: 'highlights', clip: { x: plot.x, y: plot.y, width: plot.width, height: plot.height }, items },
    { id: 'overlay-outline', items: outline },
  ];
}
