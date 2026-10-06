import { useDeferredValue, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fromIstInputValue,
  messagesToPrint,
  PRINT_HOURS,
  printFileName,
  printTitle,
  toIstInputValue,
  type PrintOptions,
} from '../../current-chart/application/printChart';
import { formatIstDateTime } from '../../current-chart/application/trainDescriptions';
import type { EpenMessage } from '../../current-chart/domain';
import { FloatingPanel } from '../common/FloatingPanel';

interface PrintDialogProps {
  boardId: number | undefined;
  initial: PrintOptions;
  /** Every saved EPEN note; the ones inside the printed period are printed. */
  messages: readonly EpenMessage[];
  /** Forecast lines on the chart come from sample data and must say so on paper too. */
  sampleForecast: boolean;
  /** Draws the chart for these options and returns it as a PNG data URL. */
  renderImage: (options: PrintOptions) => string;
  onClose: () => void;
}

const TOGGLES: { key: 'showSpeed' | 'showGainLoss' | 'showCrew' | 'showMessages'; label: string }[] = [
  { key: 'showSpeed', label: 'Speed' },
  { key: 'showGainLoss', label: 'Gain/Loss' },
  { key: 'showCrew', label: 'Crew' },
  { key: 'showMessages', label: 'EPEN messages' },
];

/** Manual §12 Print Chart: choose the shift and what to show, preview, then print or save. */
export default function PrintDialog(props: PrintDialogProps) {
  const { boardId, messages, renderImage } = props;
  const [options, setOptions] = useState(props.initial);
  const [printedAt] = useState(() => Date.now());

  // The controller's name is printed as text, so typing it does not redraw the chart.
  const { start, hours, showSpeed, showGainLoss, showCrew, showMessages } = options;
  const drawn = useDeferredValue(
    useMemo(
      () => ({ start, hours, showSpeed, showGainLoss, showCrew, showMessages, controllerName: '' }),
      [start, hours, showSpeed, showGainLoss, showCrew, showMessages],
    ),
  );
  const image = useMemo(() => {
    try {
      return { url: renderImage(drawn) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [renderImage, drawn]);

  const notes = messagesToPrint(messages, options);
  const title = printTitle(boardId, options);

  const save = () => {
    if (!image.url) return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = printFileName(boardId, options);
    link.click();
  };

  return (
    <FloatingPanel title="Print Chart" onClose={props.onClose} className="print-dialog">
      <div className="print-form">
        <label>
          Shift start (IST)
          <input
            type="datetime-local"
            value={toIstInputValue(options.start)}
            onChange={(e) => {
              const next = fromIstInputValue(e.target.value);
              if (next !== undefined) setOptions({ ...options, start: next });
            }}
          />
        </label>
        <label>
          Shift hours
          <input
            type="number"
            min={PRINT_HOURS.min}
            max={PRINT_HOURS.max}
            step={0.25}
            value={options.hours}
            onChange={(e) => {
              const next = e.target.valueAsNumber;
              if (next >= PRINT_HOURS.min && next <= PRINT_HOURS.max) setOptions({ ...options, hours: next });
            }}
          />
        </label>
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="check">
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => {
                setOptions({ ...options, [key]: e.target.checked });
              }}
            />
            {label}
          </label>
        ))}
        <label>
          Controller name
          <input
            type="text"
            value={options.controllerName}
            maxLength={60}
            onChange={(e) => {
              setOptions({ ...options, controllerName: e.target.value });
            }}
          />
        </label>
      </div>

      {image.url ? (
        <img className="print-preview" src={image.url} alt={`Preview of the printed chart: ${title}`} />
      ) : (
        <p className="error" role="alert">
          The chart could not be drawn for printing. {image.error}
        </p>
      )}
      <p className="muted">
        {title}
        {notes.length > 0 ? ` · ${notes.length} EPEN message(s) printed below the chart` : ''}
      </p>

      <div className="dialog-actions">
        <button type="button" onClick={save} disabled={!image.url}>
          Save PNG
        </button>
        <button
          type="button"
          className="primary"
          disabled={!image.url}
          onClick={() => {
            window.print();
          }}
        >
          Print
        </button>
      </div>

      {createPortal(
        <div className="print-sheet">
          <div className="print-sheet-title">
            <strong>Current Chart</strong>
            <span>{title}</span>
          </div>
          {image.url && <img src={image.url} alt="" />}
          <div className="print-sheet-footer">
            <span>Controller: {options.controllerName || '____________________'}</span>
            {props.sampleForecast && <span>Forecast lines are sample data</span>}
            <span>Printed {formatIstDateTime(printedAt)} IST</span>
          </div>
          {notes.map((note) => (
            <figure key={note.id} className="print-sheet-note">
              <figcaption>
                EPEN message · {formatIstDateTime(note.at)}
                {note.stationCode ? ` · ${note.stationCode}` : ''}
              </figcaption>
              <img src={note.payload} alt="Handwritten controller note" />
            </figure>
          ))}
        </div>,
        document.body,
      )}
    </FloatingPanel>
  );
}
