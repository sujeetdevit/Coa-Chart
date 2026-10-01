import Konva from 'konva';
import type {
  ChartGesture,
  ChartRenderModel,
  ChartRenderer,
  LinePrimitive,
  Primitive,
  PrimitiveGroup,
  RectPrimitive,
  RenderLayerName,
  TextPrimitive,
} from '../types';

const LAYER_ORDER: RenderLayerName[] = ['background', 'axes', 'interaction'];

type Shape = Konva.Rect | Konva.Line | Konva.Text;

interface GroupState {
  group: Konva.Group;
  nodes: Map<string, { kind: Primitive['kind']; node: Shape }>;
}

/** Pixels of pointer travel before a press becomes a drag (so clicks stay clicks). */
const DRAG_THRESHOLD = 3;

/**
 * Draws a ChartRenderModel with Konva. Nodes are keyed by primitive id and updated in place;
 * hit detection is done by the chart engine, so no shape listens for events and Konva skips
 * its hit-canvas work entirely.
 */
export class KonvaRenderer implements ChartRenderer {
  private stage: Konva.Stage | undefined;
  private container: HTMLElement | undefined;
  private readonly layers = new Map<RenderLayerName, Konva.Layer>();
  private readonly groups = new Map<RenderLayerName, Map<string, GroupState>>();
  private readonly handlers = new Set<(gesture: ChartGesture) => void>();
  private readonly cleanup: (() => void)[] = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.stage = new Konva.Stage({ container: container as HTMLDivElement, listening: false });
    for (const name of LAYER_ORDER) {
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
    if (stage.width() !== model.width || stage.height() !== model.height) {
      stage.size({ width: model.width, height: model.height });
    }
    for (const name of LAYER_ORDER) {
      const layer = this.layers.get(name);
      const groups = this.groups.get(name);
      if (!layer || !groups) continue;
      this.reconcileLayer(layer, groups, model.layers[name]);
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
      if (spec.clip) state.group.clip(spec.clip);
      else state.group.clip({ x: 0, y: 0, width: 0, height: 0 });
      reconcileGroup(state, spec.items);
    }
    for (const [id, state] of states) {
      if (!seen.has(id)) {
        state.group.destroy();
        states.delete(id);
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

    const endPress = (e: PointerEvent) => {
      if (!press || e.pointerId !== press.id) return;
      if (press.dragging && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = '';
      press = undefined;
    };
    listen('pointerup', endPress);
    listen('pointercancel', endPress);

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

function createNode(item: Primitive): Shape {
  switch (item.kind) {
    case 'rect':
      return new Konva.Rect({ listening: false, perfectDrawEnabled: false });
    case 'line':
      return new Konva.Line({ listening: false, perfectDrawEnabled: false });
    case 'text':
      return new Konva.Text({ listening: false, perfectDrawEnabled: false });
  }
}

function updateNode(node: Shape, item: Primitive): void {
  switch (item.kind) {
    case 'rect':
      updateRect(node as Konva.Rect, item);
      return;
    case 'line':
      updateLine(node as Konva.Line, item);
      return;
    case 'text':
      updateText(node as Konva.Text, item);
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
    x: item.x,
    y: item.y,
  });
  // Konva positions text by its top-left corner; shift so the anchor sits where requested.
  node.offsetX(node.width() * ALIGN_FACTOR[item.align]);
  node.offsetY(node.height() * BASELINE_FACTOR[item.baseline]);
}
