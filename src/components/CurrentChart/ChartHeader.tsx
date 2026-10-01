import { istClock, type CurrentChartModel, type EpochMs, type TimeRange } from '../../current-chart/domain';

interface ChartHeaderProps {
  model: CurrentChartModel;
  visible: TimeRange | undefined;
  frozen: boolean;
  onReset: () => void;
  onZoomTime: (factor: number) => void;
  onZoomStations: (factor: number) => void;
  onSettings: () => void;
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

export function ChartHeader(props: ChartHeaderProps) {
  const { model, visible } = props;
  return (
    <header className="chart-header">
      <span className="chart-title">Current Chart</span>
      <span>Board {model.board.id ?? '—'}</span>
      {visible && <span>{describeRange(visible)} IST</span>}
      <span className="muted">
        Last report {istDate(model.asOf)} {istTime(model.asOf)}
      </span>
      {props.frozen && <span className="badge frozen">Frozen</span>}
      <span className="toolbar">
        <button
          type="button"
          onClick={props.onReset}
          title="Back to the current window (double-click the chart)"
        >
          Now
        </button>
        <span className="button-group" aria-label="Time zoom">
          <button
            type="button"
            onClick={() => {
              props.onZoomTime(1 / ZOOM_STEP);
            }}
            title="Zoom out time (wheel)"
          >
            Time −
          </button>
          <button
            type="button"
            onClick={() => {
              props.onZoomTime(ZOOM_STEP);
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
              props.onZoomStations(1 / ZOOM_STEP);
            }}
            title="Zoom out stations (Ctrl+wheel, or wheel over station names)"
          >
            Stations −
          </button>
          <button
            type="button"
            onClick={() => {
              props.onZoomStations(ZOOM_STEP);
            }}
            title="Zoom in stations (Ctrl+wheel, or wheel over station names)"
          >
            Stations +
          </button>
        </span>
        <button type="button" onClick={props.onSettings} title="Chart preferences">
          Settings
        </button>
      </span>
    </header>
  );
}
