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
}

export type Primitive = RectPrimitive | LinePrimitive | TextPrimitive;

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

/** Layer names map to renderer layers. Static/rarely changing content stays out of `interaction`. */
export type RenderLayerName = 'background' | 'axes' | 'interaction';

export interface ChartRenderModel {
  width: number;
  height: number;
  layers: Record<RenderLayerName, PrimitiveGroup[]>;
}
