import type { ForecastWorkflowState } from '../../current-chart/application/forecast/forecastWorkflow';

interface ForecastBarProps {
  state: ForecastWorkflowState;
  onOption: (option: 'manualOption' | 'haltOption', value: boolean) => void;
  onBasic: () => void;
  onFull: () => void;
  onManual: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onWrong: () => void;
}

const MODE = { none: '', basic: 'Basic forecast', full: 'Full forecast', manual: 'Manual forecast' } as const;

/** Manual §11.1.2 forecast controls: Manual, Halt Data, WFS, MF, BF, FF, CMI, Reset. */
export function ForecastBar({ state, ...on }: ForecastBarProps) {
  const disabled = state.busy;
  return (
    <div className="forecast-bar" role="toolbar" aria-label="Forecast">
      <span className="forecast-status" aria-live="polite">
        {state.source === 'sample' && <span className="badge">Sample data</span>}
        {MODE[state.mode] && <strong>{MODE[state.mode]}</strong>}
        {state.busy ? 'Working…' : state.message}
      </span>
      <span className="toggles">
        <label title="Required before MF">
          <input
            type="checkbox"
            checked={state.manualOption}
            onChange={(e) => {
              on.onOption('manualOption', e.target.checked);
            }}
          />
          Manual
        </label>
        <label title="FF opens the Train Manual Halt form">
          <input
            type="checkbox"
            checked={state.haltOption}
            onChange={(e) => {
              on.onOption('haltOption', e.target.checked);
            }}
          />
          Halt Data
        </label>
      </span>
      <span className="button-group">
        <button
          type="button"
          disabled={disabled}
          onClick={on.onWrong}
          title="Wrong Forecast Shown: save it for analysis"
        >
          WFS
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={on.onManual}
          title="Convert the full forecast into a manual forecast"
        >
          MF
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={on.onBasic}
          title="Basic forecast of trains visible on the chart"
        >
          BF
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={on.onFull}
          title="Full forecast of trains visible on the chart"
        >
          FF
        </button>
        <button type="button" disabled={disabled} onClick={on.onConfirm} title="Confirm Manual Intervention">
          CMI
        </button>
        <button type="button" disabled={disabled} onClick={on.onReset} title="Clear forecasts">
          Reset
        </button>
      </span>
    </div>
  );
}
