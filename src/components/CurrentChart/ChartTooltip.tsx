import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { TooltipContent } from '../../current-chart/application/trainDescriptions';

export interface ChartTooltipHandle {
  show(content: TooltipContent, x: number, y: number): void;
  hide(): void;
}

const OFFSET = 14;

/**
 * Hover tooltip over the chart. Content changes go through React; position updates are applied
 * directly to the element so pointer movement doesn't re-render anything.
 */
export function ChartTooltip({ ref }: { ref: Ref<ChartTooltipHandle> }) {
  const elRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<TooltipContent>();

  useImperativeHandle(ref, () => ({
    show(next, x, y) {
      setContent((prev) =>
        prev?.title === next.title && prev.lines.join('\n') === next.lines.join('\n') ? prev : next,
      );
      const el = elRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      // Flip to the other side of the pointer near the right/bottom edges.
      const flipX = x + OFFSET + el.offsetWidth > parent.clientWidth;
      const flipY = y + OFFSET + el.offsetHeight > parent.clientHeight;
      const left = flipX ? x - OFFSET - el.offsetWidth : x + OFFSET;
      const top = flipY ? y - OFFSET - el.offsetHeight : y + OFFSET;
      el.style.transform = `translate(${Math.max(0, left)}px, ${Math.max(0, top)}px)`;
    },
    hide() {
      setContent(undefined);
    },
  }));

  return (
    <div ref={elRef} className="chart-tooltip" hidden={!content} role="tooltip">
      {content && (
        <>
          <div className="chart-tooltip-title">{content.title}</div>
          {content.lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </>
      )}
    </div>
  );
}
