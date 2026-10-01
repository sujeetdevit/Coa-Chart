// Renderer-independent description of what to draw. Geometry is in stage pixels; styles are
// resolved values. No business logic, no Konva. Every primitive has an id that is stable across
// frames so a renderer can update nodes in place instead of rebuilding the scene.

export interface RectPrimitive {
  kind: 'rect';
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface CirclePrimitive {
  kind: 'circle';
  id: string;
  x: number;
  y: number;
  radius: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

/** Many disjoint straight segments drawn as one node: flat [x1, y1, x2, y2, …]. */
export interface SegmentsPrimitive {
  kind: 'segments';
  id: string;
  points: number[];
  stroke: string;
  strokeWidth: number;
  opacity?: number;
}

export interface LinePrimitive {
  kind: 'line';
  id: string;
  /** Flat x,y pairs. */
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  opacity?: number;
  lineCap?: 'butt' | 'round';
  lineJoin?: 'miter' | 'round';
  /** Close the path and fill it (polygons, e.g. caution icons). */
  closed?: boolean;
  fill?: string;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';

export interface TextPrimitive {
  kind: 'text';
  id: string;
  /** Anchor point; `align` and `baseline` say which part of the text sits on it. */
  x: number;
  y: number;
  text: string;
  fill: string;
  fontSize: number;
  fontFamily: string;
  bold?: boolean;
  align: TextAlign;
  baseline: TextBaseline;
  /** Line height multiplier for multi-line text (lines separated by "\n"). */
  lineHeight?: number;
  opacity?: number;
}

export type Primitive = RectPrimitive | CirclePrimitive | SegmentsPrimitive | LinePrimitive | TextPrimitive;

export interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrimitiveGroup {
  id: string;
  clip?: ClipRect;
  items: Primitive[];
}

/**
 * Layer names map to renderer layers, bottom to top. Hover/selection lives only in `interaction`
 * so pointer movement never redraws the rest.
 */
export type RenderLayerName = 'background' | 'infrastructure' | 'movement' | 'axes' | 'interaction';

export const RENDER_LAYER_ORDER: readonly RenderLayerName[] = [
  'background',
  'infrastructure',
  'movement',
  'axes',
  'interaction',
];

/**
 * A renderer may skip a layer whose group array is the same object as in the previous model,
 * so builders should reuse layer arrays that did not change.
 */
export interface ChartRenderModel {
  width: number;
  height: number;
  layers: Record<RenderLayerName, PrimitiveGroup[]>;
}
