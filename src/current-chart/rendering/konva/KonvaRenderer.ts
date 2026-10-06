import Konva from 'konva/lib/Core';
import {
  RENDER_LAYER_ORDER,
  type ChartGesture,
  type ChartRenderModel,
  type ChartRenderer,
  type Primitive,
  type PrimitiveGroup,
  type RenderLayerName,
} from '../types';
import { paintPrimitives } from './paintPrimitives';

interface GroupState {
  /** Carries the clip. */
  group: Konva.Group;
  /** Paints every primitive of the group in one pass. */
  shape: Konva.Shape;
  items: readonly Primitive[];
}

/** Pixels of pointer travel before a press becomes a drag (so clicks stay clicks). */
const DRAG_THRESHOLD = 3;

/**
 * Draws a ChartRenderModel with Konva: a Konva layer per render layer, a clipped Konva group per
 * primitive group, and one custom shape per group that paints its primitives directly. A layer
 * whose group array is unchanged from the previous model is not redrawn. Hit detection is done
 * by the chart engine, so no shape listens for events and Konva skips its hit-canvas work.
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

  toImage(pixelRatio = 1): string {
    return this.stage?.toDataURL({ pixelRatio, mimeType: 'image/png' }) ?? '';
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
        state = createGroupState();
        states.set(spec.id, state);
        layer.add(state.group);
        orderChanged = true;
      }
      // A zero-size clip means "no clip" to Konva.
      state.group.clip(spec.clip ?? { x: 0, y: 0, width: 0, height: 0 });
      state.items = spec.items;
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
    let press:
      { x: number; y: number; id: number; dragging: boolean; origin: { x: number; y: number } } | undefined;

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
      press = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false, origin: this.local(e) };
    });

    listen('pointermove', (e) => {
      if (press && e.pointerId === press.id) {
        const dx = e.clientX - press.x;
        const dy = e.clientY - press.y;
        if (!press.dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
          press.dragging = true;
          this.emit({ type: 'dragStart', ...press.origin });
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            // Pointer no longer active (e.g. released outside the window): drag without capture.
          }
        }
        if (press.dragging) {
          press.x = e.clientX;
          press.y = e.clientY;
          this.emit({ type: 'drag', dx, dy, ...this.local(e) });
          return;
        }
      }
      this.emit({ type: 'pointerMove', ...this.local(e) });
    });

    listen('pointerup', (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (press.dragging) {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        this.emit({ type: 'dragEnd', ...this.local(e) });
      } else {
        this.emit({ type: 'click', ...this.local(e) });
      }
      press = undefined;
    });

    listen('contextmenu', (e) => {
      e.preventDefault();
      this.emit({ type: 'contextMenu', ...this.local(e) });
    });

    listen('pointercancel', (e) => {
      if (!press || e.pointerId !== press.id) return;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (press.dragging) this.emit({ type: 'dragEnd', ...this.local(e) });
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

function createGroupState(): GroupState {
  const state: GroupState = {
    group: new Konva.Group({ listening: false }),
    shape: new Konva.Shape({ listening: false, perfectDrawEnabled: false }),
    items: [],
  };
  state.shape.sceneFunc((context) => {
    paintPrimitives(context._context, state.items);
  });
  state.group.add(state.shape);
  return state;
}
