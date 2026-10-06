import { formatIstTime } from '../../current-chart/application/trainDescriptions';
import { istClock, type CurrentChartModel, type EpochMs, type TimeRange } from '../../current-chart/domain';
import type { ChartRefreshControls } from './chartServices';

interface ChartHeaderProps {
  model: CurrentChartModel;
  visible: TimeRange | undefined;
  frozen: boolean;
  refresh: ChartRefreshControls;
  onPrint: () => void;
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
  const { model, visible, refresh } = props;
  return (
    <header className="chart-header">
      <span className="chart-title">Current Chart</span>
      <span>Board {model.board.id ?? '—'}</span>
      {visible && <span>{describeRange(visible)} IST</span>}
      <span className="muted">
        Last report {istDate(model.asOf)} {istTime(model.asOf)}
      </span>
      {props.frozen && <span className="badge frozen">Frozen</span>}
      {refresh.error === undefined ? (
        <span className="muted" title="When the data on screen was last checked with the source">
          {refresh.refreshing ? 'Refreshing…' : `Updated ${formatIstTime(refresh.loadedAt, true)}`}
        </span>
      ) : (
        <span className="badge problem" role="status" title={refresh.error}>
          Refresh failed · showing data from {formatIstTime(refresh.loadedAt, true)}
        </span>
      )}
      <span className="toolbar">
        <label
          className="auto-refresh"
          title={`Reload the data every ${refresh.intervalSeconds / 60} minutes (waits while Freeze is on)`}
        >
          <input
            type="checkbox"
            checked={refresh.auto}
            onChange={(e) => {
              refresh.onAutoChange(e.target.checked);
            }}
          />
          Auto refresh
        </label>
        <button
          type="button"
          onClick={refresh.onRefresh}
          disabled={refresh.refreshing}
          title="Reload the data now"
        >
          Refresh
        </button>
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
        <button type="button" onClick={props.onPrint} title="Print the chart or save it as an image">
          Print
        </button>
        <button type="button" onClick={props.onSettings} title="Chart preferences">
          Settings
        </button>
      </span>
    </header>
  );
}
