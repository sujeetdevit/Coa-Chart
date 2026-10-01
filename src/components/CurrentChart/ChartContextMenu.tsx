import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface ChartContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Right-click menu over the chart (EPEN Write Pad / Message Show, single-train forecast). */
export function ChartContextMenu({ x, y, items, onClose }: ChartContextMenuProps) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [onClose]);

  return (
    <ul ref={ref} className="context-menu" role="menu" style={{ left: x, top: y }}>
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
