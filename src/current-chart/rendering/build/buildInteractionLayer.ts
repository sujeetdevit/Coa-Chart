import type { TrainScene, TrainSceneItem } from '../../application/trainScene';
import type { ChartTheme } from '../../configuration/chartTheme';
import type { CurrentChartEngine, Rect } from '../../engine';
import type { Primitive, PrimitiveGroup } from '../types';

export interface ChartHover {
  trainId: string;
  /** Hovered vertex of the actual path, if the pointer is on a point rather than a line. */
  pointIndex?: number;
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

/** Selection and hover highlights. Rebuilt on pointer movement; everything else stays cached. */
export function buildInteractionLayer(
  scene: TrainScene,
  engine: CurrentChartEngine,
  hover: ChartHover | undefined,
  selectedTrainId: string | undefined,
  theme: ChartTheme,
  /** Hovered overlay item (block, icon, box, remark), in stage coordinates. */
  overlayRect?: Rect,
): PrimitiveGroup[] {
  const { plot } = engine.getChartBounds();
  const ox = plot.x;
  const oy = plot.y;
  const t = theme.interaction;
  const items: Primitive[] = [];

  const selected = selectedTrainId ? scene.byId.get(selectedTrainId) : undefined;
  if (selected) items.push(...halo(selected, 'sel', ox, oy, t.selectedWidth, t.selectedOpacity));

  const hovered = hover ? scene.byId.get(hover.trainId) : undefined;
  if (hovered && hovered !== selected)
    items.push(...halo(hovered, 'hov', ox, oy, t.hoverWidth, t.hoverOpacity));

  const point = hover?.pointIndex !== undefined ? hovered?.actual.points[hover.pointIndex] : undefined;
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

  const outline: Primitive[] = overlayRect
    ? [
        {
          kind: 'rect',
          id: 'hov-overlay',
          x: overlayRect.x - 1,
          y: overlayRect.y - 1,
          width: overlayRect.width + 2,
          height: overlayRect.height + 2,
          fill: 'transparent',
          stroke: t.overlayOutline,
          strokeWidth: 1.5,
        },
      ]
    : [];

  return [
    { id: 'highlights', clip: { x: plot.x, y: plot.y, width: plot.width, height: plot.height }, items },
    { id: 'overlay-outline', items: outline },
  ];
}
