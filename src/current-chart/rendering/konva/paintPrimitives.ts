import type {
  CirclePrimitive,
  LinePrimitive,
  Primitive,
  RectPrimitive,
  SegmentsPrimitive,
  TextPrimitive,
} from '../types';

/** The part of CanvasRenderingContext2D the painter uses (so tests can pass a recorder). */
export type PaintContext = Pick<
  CanvasRenderingContext2D,
  | 'globalAlpha'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'setLineDash'
>;

const NO_DASH: number[] = [];
const BASELINE_FACTOR = { top: 0, middle: 0.5, bottom: 1 } as const;

/**
 * Paints a group's primitives straight onto a canvas context, in order (later items on top).
 * One Konva shape per group calls this, which is far cheaper than a Konva node per primitive:
 * a chart frame has over a thousand text labels.
 */
export function paintPrimitives(ctx: PaintContext, items: readonly Primitive[]): void {
  // Assigning ctx.font is expensive (the browser re-parses it), so only do it when it changes.
  let font = '';
  for (const item of items) {
    ctx.globalAlpha = item.opacity ?? 1;
    switch (item.kind) {
      case 'rect':
        paintRect(ctx, item);
        break;
      case 'circle':
        paintCircle(ctx, item);
        break;
      case 'line':
        paintLine(ctx, item);
        break;
      case 'segments':
        paintSegments(ctx, item);
        break;
      case 'text': {
        const next = fontOf(item);
        if (next !== font) {
          ctx.font = next;
          font = next;
        }
        paintText(ctx, item);
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
}

function paintRect(ctx: PaintContext, item: RectPrimitive): void {
  ctx.fillStyle = item.fill;
  ctx.fillRect(item.x, item.y, item.width, item.height);
  if (item.stroke !== undefined && item.strokeWidth) {
    ctx.setLineDash(NO_DASH);
    ctx.strokeStyle = item.stroke;
    ctx.lineWidth = item.strokeWidth;
    ctx.lineJoin = 'miter';
    ctx.strokeRect(item.x, item.y, item.width, item.height);
  }
}

function paintCircle(ctx: PaintContext, item: CirclePrimitive): void {
  ctx.beginPath();
  ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
  if (item.fill !== undefined) {
    ctx.fillStyle = item.fill;
    ctx.fill();
  }
  if (item.stroke !== undefined && item.strokeWidth) {
    ctx.setLineDash(NO_DASH);
    ctx.strokeStyle = item.stroke;
    ctx.lineWidth = item.strokeWidth;
    ctx.stroke();
  }
}

function paintLine(ctx: PaintContext, item: LinePrimitive): void {
  const { points } = item;
  if (points.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let i = 2; i + 1 < points.length; i += 2) ctx.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  if (item.closed) ctx.closePath();
  if (item.fill !== undefined) {
    ctx.fillStyle = item.fill;
    ctx.fill();
  }
  ctx.setLineDash(item.dash ?? NO_DASH);
  ctx.strokeStyle = item.stroke;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = item.lineCap ?? 'butt';
  ctx.lineJoin = item.lineJoin ?? 'miter';
  ctx.stroke();
}

/** One path for many disjoint segments (tick marks, grid lines). */
function paintSegments(ctx: PaintContext, item: SegmentsPrimitive): void {
  const { points } = item;
  ctx.beginPath();
  for (let i = 0; i + 3 < points.length; i += 4) {
    ctx.moveTo(points[i] ?? 0, points[i + 1] ?? 0);
    ctx.lineTo(points[i + 2] ?? 0, points[i + 3] ?? 0);
  }
  ctx.setLineDash(NO_DASH);
  ctx.strokeStyle = item.stroke;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = 'butt';
  ctx.stroke();
}

function fontOf(item: TextPrimitive): string {
  return `${item.bold ? 'bold ' : ''}${item.fontSize}px ${item.fontFamily}`;
}

/** The anchor (x, y) is where `align` and `baseline` say it is; multi-line text is one block. */
function paintText(ctx: PaintContext, item: TextPrimitive): void {
  ctx.fillStyle = item.fill;
  ctx.textAlign = item.align;
  ctx.textBaseline = 'middle';
  const lineHeight = item.fontSize * (item.lineHeight ?? 1);
  if (!item.text.includes('\n')) {
    ctx.fillText(item.text, item.x, item.y + lineHeight * (0.5 - BASELINE_FACTOR[item.baseline]));
    return;
  }
  const lines = item.text.split('\n');
  const top = item.y - lines.length * lineHeight * BASELINE_FACTOR[item.baseline];
  lines.forEach((line, i) => {
    ctx.fillText(line, item.x, top + (i + 0.5) * lineHeight);
  });
}
