import type { CSSProperties, ReactNode } from 'react';

interface FloatingPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

/** A titled panel floating over the chart, e.g. legends, MSM, write pad. */
export function FloatingPanel({ title, onClose, children, style, className }: FloatingPanelProps) {
  return (
    <section className={`floating-panel ${className ?? ''}`} style={style} role="dialog" aria-label={title}>
      <header>
        <strong>{title}</strong>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="floating-panel-body">{children}</div>
    </section>
  );
}
