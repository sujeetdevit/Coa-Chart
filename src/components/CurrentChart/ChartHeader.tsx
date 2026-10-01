import type { ChartDisplayOptions } from '../../current-chart/application/displayOptions';
import { istClock, type CurrentChartModel, type EpochMs, type TimeRange } from '../../current-chart/domain';

const TOGGLES: { key: keyof ChartDisplayOptions; label: string; title: string }[] = [
  { key: 'showCrew', label: 'Crew', title: 'Crew details on the train label' },
  {
    key: 'highlightGps',
    label: 'GPS Loco',
    title: 'Highlight GPS-loco enabled trains (RTIS / REMLOT reported)',
  },
  { key: 'showGainLoss', label: 'Gain/Loss', title: 'Detention in red, gain in green' },
  { key: 'showSpeed', label: 'Speed', title: 'Speed at each departure' },
  {
    key: 'showLastTrainLabel',
    label: 'Last label',
    title: 'Floating train label at the end of each train line (preference "Show Last Train Label")',
  },
];

interface ChartHeaderProps {
  model: CurrentChartModel;
  visible: TimeRange | undefined;
  options: ChartDisplayOptions;
  onOptionsChange: (options: ChartDisplayOptions) => void;
  onReset: () => void;
  onZoomTime: (factor: number) => void;
  onZoomStations: (factor: number) => void;
}

const ZOOM_STEP = 1.25;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function istDate(ms: EpochMs): string {
  const c = istClock(ms);
  return `${pad(c.day)}-${pad(c.month)}-${c.year}`;
}

function istTime(ms: EpochMs): string {
  const c = istClock(ms);
  return `${pad(c.hour)}:${pad(c.minute)}`;
}

function describeRange(range: TimeRange): string {
  const sameDay = istDate(range.start) === istDate(range.end);
  return sameDay
    ? `${istDate(range.start)} ${istTime(range.start)} – ${istTime(range.end)}`
    : `${istDate(range.start)} ${istTime(range.start)} – ${istDate(range.end)} ${istTime(range.end)}`;
}

export function ChartHeader({
  model,
  visible,
  options,
  onOptionsChange,
  onReset,
  onZoomTime,
  onZoomStations,
}: ChartHeaderProps) {
  return (
    <header className="chart-header">
      <span className="chart-title">Current Chart</span>
      <span>Board {model.board.id ?? '—'}</span>
      {visible && <span>{describeRange(visible)} IST</span>}
      <span className="muted">
        Last report {istDate(model.asOf)} {istTime(model.asOf)}
      </span>
      <span className="toolbar">
        <span className="toggles">
          {TOGGLES.map(({ key, label, title }) => (
            <label key={key} title={title}>
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(e) => {
                  onOptionsChange({ ...options, [key]: e.target.checked });
                }}
              />
              {label}
            </label>
          ))}
        </span>
        <button type="button" onClick={onReset} title="Back to the current window (double-click the chart)">
          Now
        </button>
        <span className="button-group" aria-label="Time zoom">
          <button
            type="button"
            onClick={() => {
              onZoomTime(1 / ZOOM_STEP);
            }}
            title="Zoom out time (wheel)"
          >
            Time −
          </button>
          <button
            type="button"
            onClick={() => {
              onZoomTime(ZOOM_STEP);
            }}
            title="Zoom in time (wheel)"
          >
            Time +
          </button>
        </span>
        <span className="button-group" aria-label="Station zoom">
          <button
            type="button"
            onClick={() => {
              onZoomStations(1 / ZOOM_STEP);
            }}
            title="Zoom out stations (Ctrl+wheel, or wheel over station names)"
          >
            Stations −
          </button>
          <button
            type="button"
            onClick={() => {
              onZoomStations(ZOOM_STEP);
            }}
            title="Zoom in stations (Ctrl+wheel, or wheel over station names)"
          >
            Stations +
          </button>
        </span>
      </span>
    </header>
  );
}
