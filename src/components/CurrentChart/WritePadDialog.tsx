import { useRef } from 'react';
import { FloatingPanel } from '../common/FloatingPanel';

interface WritePadDialogProps {
  /** What the note is written against, shown in the title. */
  context: string;
  onSave: (imageDataUrl: string) => void;
  onClose: () => void;
}

const WIDTH = 520;
const HEIGHT = 300;

/**
 * EPEN Write Pad (manual §11.1.1): write with an e-pen (or mouse/touch) and Save. Pen pressure
 * varies the stroke width when the device reports it.
 */
export function WritePadDialog({ context, onSave, onClose }: WritePadDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<{ x: number; y: number } | undefined>(undefined);
  const dirty = useRef(false);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const ctx = () => canvasRef.current?.getContext('2d') ?? undefined;

  return (
    <FloatingPanel title={`Write Pad — ${context}`} onClose={onClose} className="write-pad">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="write-pad-canvas"
        onPointerDown={(e) => {
          drawing.current = pos(e);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Pointer no longer active: draw without capture.
          }
        }}
        onPointerMove={(e) => {
          const from = drawing.current;
          const c = ctx();
          if (!from || !c) return;
          const to = pos(e);
          c.strokeStyle = '#0a2a8a';
          c.lineCap = 'round';
          c.lineWidth = e.pointerType === 'pen' && e.pressure > 0 ? 1 + e.pressure * 3 : 2;
          c.beginPath();
          c.moveTo(from.x, from.y);
          c.lineTo(to.x, to.y);
          c.stroke();
          drawing.current = to;
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = undefined;
        }}
      />
      <div className="dialog-actions">
        <button
          type="button"
          onClick={() => {
            ctx()?.clearRect(0, 0, WIDTH, HEIGHT);
            dirty.current = false;
          }}
        >
          Clear
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            const canvas = canvasRef.current;
            if (canvas && dirty.current) onSave(canvas.toDataURL('image/png'));
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </FloatingPanel>
  );
}
