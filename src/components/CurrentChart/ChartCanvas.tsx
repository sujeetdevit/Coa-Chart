import { useEffect, useRef } from 'react';
import { createChartRenderer } from '../../current-chart/rendering/konva';
import type { ChartGesture, ChartRenderModel, ChartRenderer } from '../../current-chart/rendering/types';

interface ChartCanvasProps {
  renderModel: ChartRenderModel | undefined;
  onGesture: (gesture: ChartGesture) => void;
}

/**
 * Hosts the chart renderer. React owns only the container element; drawing happens in the
 * renderer, at most once per animation frame however often the model changes.
 */
export function ChartCanvas({ renderModel, onGesture }: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ChartRenderer>(undefined);
  const pendingRef = useRef<ChartRenderModel>(undefined);
  const frameRef = useRef(0);
  const gestureRef = useRef(onGesture);

  useEffect(() => {
    gestureRef.current = onGesture;
  }, [onGesture]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const renderer = createChartRenderer();
    renderer.mount(container);
    const unsubscribe = renderer.onGesture((g) => {
      gestureRef.current(g);
    });
    rendererRef.current = renderer;
    if (pendingRef.current) renderer.render(pendingRef.current);
    return () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      unsubscribe();
      renderer.destroy();
      rendererRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (!renderModel) return;
    pendingRef.current = renderModel;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const model = pendingRef.current;
      if (model) rendererRef.current?.render(model);
    });
  }, [renderModel]);

  return <div ref={containerRef} className="chart-canvas" />;
}
