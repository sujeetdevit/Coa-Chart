import Konva from 'konva';
import {
  RENDER_LAYER_ORDER,
  type ChartGesture,
  type ChartRenderModel,
  type ChartRenderer,
  type CirclePrimitive,
  type LinePrimitive,
  type Primitive,
  type PrimitiveGroup,
  type RectPrimitive,
  type RenderLayerName,
  type SegmentsPrimitive,
  type TextPrimitive,
} from '../types';

type Shape = Konva.Rect | Konva.Circle | Konva.Line | Konva.Text | Konva.Shape;

interface GroupState {
  group: Konva.Group;
  nodes: Map<string, { kind: Primitive['kind']; node: Shape }>;
}

/** Pixels of pointer travel before a press becomes a drag (so clicks stay clicks). */
const DRAG_THRESHOLD = 3;

/**
 * Draws a ChartRenderModel with Konva. Nodes are keyed by primitive id and updated in place;
 * a layer whose group array is unchanged from the previous model is neither reconciled nor
 * redrawn. Hit detection is done by the chart engine, so no shape listens for events and Konva
 * skips its hit-canvas work entirely.
 */
export class KonvaRenderer implements ChartRenderer {
  private stage: Konva.Stage | undefined;
  private container: HTMLElement | undefined;
  private readonly layers = new Map<RenderLayerName, Konva.Layer>();
  private readonly groups = new Map<RenderLayerName, Map<string, GroupState>>();
  private readonly lastLayers = new Map<RenderLayerName, PrimitiveGroup[]>();
  private readonly handlers = new Set<(gesture: ChartGesture) => void>();
  private readonly cleanup: (() => void)[] = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.stage = new Konva.Stage({ container: container as HTMLDivElement, listening: false });
    for (const name of RENDER_LAYER_ORDER) {
      const layer = new Konva.Layer({ listening: false });
      this.stage.add(layer);
      this.layers.set(name, layer);
      this.groups.set(name, new Map());
    }
    this.bindPointerEvents(container);
  }

  render(model: ChartRenderModel): void {
    const stage = this.stage;
    if (!stage) return;
    const resized = stage.width() !== model.width || stage.height() !== model.height;
    if (resized) stage.size({ width: model.width, height: model.height });

    for (const name of RENDER_LAYER_ORDER) {
      const layer = this.layers.get(name);
      const groups = this.groups.get(name);
      const spec = model.layers[name];
      if (!layer || !groups) continue;
      if (!resized && this.lastLayers.get(name) === spec) continue;
      this.reconcileLayer(layer, groups, spec);
      this.lastLayers.set(name, spec);
      // Draw now rather than batchDraw(): callers already coalesce to one render per frame.
      layer.draw();
    }
  }

  onGesture(handler: (gesture: ChartGesture) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  destroy(): void {
    for (const fn of this.cleanup.splice(0)) fn();
    this.handlers.clear();
    this.stage?.destroy();
    this.stage = undefined;
    this.layers.clear();
    this.groups.clear();
    this.lastLayers.clear();
  }

  // ── reconciliation ────────────────────────────────────────────────────

  private reconcileLayer(
    layer: Konva.Layer,
    states: Map<string, GroupState>,
    groups: PrimitiveGroup[],
  ): void {
    const seen = new Set<string>();
    let orderChanged = false;
    for (const spec of groups) {
      seen.add(spec.id);
      let state = states.get(spec.id);
      if (!state) {
        state = { group: new Konva.Group({ listening: false }), nodes: new Map() };
        states.set(spec.id, state);
        layer.add(state.group);
        orderChanged = true;
      }
      // A zero-size clip means "no clip" to Konva.
      state.group.clip(spec.clip ?? { x: 0, y: 0, width: 0, height: 0 });
      reconcileGroup(state, spec.items);
    }
    for (const [id, state] of states) {
      if (!seen.has(id)) {
        state.group.destroy();
        states.delete(id);
        orderChanged = true;
      }
    }
    if (orderChanged) groups.forEach((spec) => states.get(spec.id)?.group.moveToTop());
  }

  // ── pointer input ─────────────────────────────────────────────────────

  private emit(gesture: ChartGesture): void {
    for (const handler of this.handlers) handler(gesture);
  }

  private local(event: MouseEvent): { x: number; y: number } {
    const rect = (this.container ?? (event.currentTarget as HTMLElement)).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private bindPointerEvents(el: HTMLElement): void {
    let press: { x: number; y: number; id: number; dragging: boolean } | undefined;

    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn, options);
      this.cleanup.push(() => {
        el.removeEventListener(type, fn, options);
      });
    };

    listen(
      'wheel',
      (e) => {
        e.preventDefault();
        const { x, y } = this.local(e);
        // Normalise line/page deltas to pixels.
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
        this.emit({
          type: 'wheel',
          x,
          y,
          deltaX: e.deltaX * unit,
          deltaY: e.deltaY * unit,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
        });
      },
      { passive: false },
    );

    listen('pointerdown', (e) => {
      if (e.button !== 0) return;
      press = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false };
    });

    listen('pointermove', (e) => {
      if (press && e.pointerId === press.id) {
        const dx = e.clientX - press.x;
        const dy = e.clientY - press.y;
        if (!press.dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          press.dragging = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            // Pointer no longer active: drag without capture.
          }
          el.style.cursor = 'grabbing';
        }
        if (press.dragging) {
          press.x = e.clientX;
          press.y = e.clientY;
          this.emit({ type: 'drag', dx, dy });
          return;
        }
      }
      this.emit({ type: 'pointerMove', ...this.local(e) });
    });

    listen('pointerup', (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (press.dragging) {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        el.style.cursor = '';
      } else {
        this.emit({ type: 'click', ...this.local(e) });
      }
      press = undefined;
    });

    listen('pointercancel', (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = '';
      press = undefined;
    });

    listen('pointerleave', () => {
      if (!press?.dragging) this.emit({ type: 'pointerLeave' });
    });

    listen('dblclick', (e) => {
      this.emit({ type: 'doubleClick', ...this.local(e) });
    });
  }
}

function reconcileGroup(state: GroupState, items: Primitive[]): void {
  const seen = new Set<string>();
  let orderChanged = false;
  for (const item of items) {
    seen.add(item.id);
    let entry = state.nodes.get(item.id);
    if (entry && entry.kind !== item.kind) {
      entry.node.destroy();
      entry = undefined;
    }
    if (!entry) {
      entry = { kind: item.kind, node: createNode(item) };
      state.nodes.set(item.id, entry);
      state.group.add(entry.node);
      orderChanged = true;
    }
    updateNode(entry.node, item);
  }
  for (const [id, entry] of state.nodes) {
    if (!seen.has(id)) {
      entry.node.destroy();
      state.nodes.delete(id);
    }
  }
  // Keep model order (later items on top) only when membership changed.
  if (orderChanged) items.forEach((item) => state.nodes.get(item.id)?.node.moveToTop());
}

const BASE = { listening: false, perfectDrawEnabled: false } as const;

function createNode(item: Primitive): Shape {
  switch (item.kind) {
    case 'rect':
      return new Konva.Rect(BASE);
    case 'circle':
      return new Konva.Circle(BASE);
    case 'line':
      return new Konva.Line(BASE);
    case 'text':
      return new Konva.Text(BASE);
    case 'segments':
      return new Konva.Shape({ ...BASE, sceneFunc: drawSegments });
  }
}

/** One path for many disjoint segments: far cheaper than a node per tick mark. */
function drawSegments(context: Konva.Context, shape: Konva.Shape): void {
  const points = shape.getAttr('points') as number[];
  context.beginPath();
  for (let i = 0; i + 3 < points.length; i += 4) {
    context.moveTo(points[i] ?? 0, points[i + 1] ?? 0);
    context.lineTo(points[i + 2] ?? 0, points[i + 3] ?? 0);
  }
  context.strokeShape(shape);
}

function updateNode(node: Shape, item: Primitive): void {
  switch (item.kind) {
    case 'rect':
      updateRect(node as Konva.Rect, item);
      return;
    case 'circle':
      updateCircle(node as Konva.Circle, item);
      return;
    case 'line':
      updateLine(node as Konva.Line, item);
      return;
    case 'text':
      updateText(node as Konva.Text, item);
      return;
    case 'segments':
      updateSegments(node as Konva.Shape, item);
      return;
  }
}

function updateRect(node: Konva.Rect, item: RectPrimitive): void {
  node.setAttrs({
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fill: item.fill,
    stroke: item.stroke ?? 'transparent',
    strokeWidth: item.strokeWidth ?? 0,
    strokeEnabled: item.stroke !== undefined,
    opacity: item.opacity ?? 1,
  });
}

function updateCircle(node: Konva.Circle, item: CirclePrimitive): void {
  node.setAttrs({
    x: item.x,
    y: item.y,
    radius: item.radius,
    fill: item.fill ?? 'transparent',
    fillEnabled: item.fill !== undefined,
    stroke: item.stroke ?? 'transparent',
    strokeWidth: item.strokeWidth ?? 0,
    strokeEnabled: item.stroke !== undefined,
    opacity: item.opacity ?? 1,
  });
}

function updateLine(node: Konva.Line, item: LinePrimitive): void {
  node.setAttrs({
    points: item.points,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
    dash: item.dash ?? [],
    dashEnabled: item.dash !== undefined,
    opacity: item.opacity ?? 1,
    lineCap: item.lineCap ?? 'butt',
    lineJoin: item.lineJoin ?? 'miter',
    closed: item.closed ?? false,
    fill: item.fill ?? 'transparent',
    fillEnabled: item.fill !== undefined,
  });
}

function updateSegments(node: Konva.Shape, item: SegmentsPrimitive): void {
  node.setAttrs({
    points: item.points,
    stroke: item.stroke,
    strokeWidth: item.strokeWidth,
    opacity: item.opacity ?? 1,
  });
}

const ALIGN_FACTOR = { left: 0, center: 0.5, right: 1 } as const;
const BASELINE_FACTOR = { top: 0, middle: 0.5, bottom: 1 } as const;

function updateText(node: Konva.Text, item: TextPrimitive): void {
  node.setAttrs({
    text: item.text,
    fill: item.fill,
    fontSize: item.fontSize,
    fontFamily: item.fontFamily,
    fontStyle: item.bold ? 'bold' : 'normal',
    lineHeight: item.lineHeight ?? 1,
    opacity: item.opacity ?? 1,
    align: item.align,
    x: item.x,
    y: item.y,
  });
  // Konva positions text by its top-left corner; shift so the anchor sits where requested.
  node.offsetX(node.width() * ALIGN_FACTOR[item.align]);
  node.offsetY(node.height() * BASELINE_FACTOR[item.baseline]);
}
