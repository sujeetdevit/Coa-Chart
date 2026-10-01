import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/** Content-box size of an element, updated on resize. Undefined until first measured. */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize | undefined {
  const [size, setSize] = useState<ElementSize>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
