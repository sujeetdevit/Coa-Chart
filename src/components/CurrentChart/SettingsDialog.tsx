import { useState } from 'react';
import type { ChartConfig } from '../../current-chart/configuration/chartConfig';
import { FloatingPanel } from '../common/FloatingPanel';

interface SettingsDialogProps {
  config: ChartConfig;
  onApply: (config: ChartConfig) => void;
  onClose: () => void;
}

type NumberField = {
  label: string;
  min: number;
  max: number;
  step?: number;
  get: (c: ChartConfig) => number;
  set: (c: ChartConfig, v: number) => ChartConfig;
};

type BoolField = {
  label: string;
  get: (c: ChartConfig) => boolean;
  set: (c: ChartConfig, v: boolean) => ChartConfig;
};

// Manual §3.1 Preferences that affect the Current Chart. Ranges follow the manual where given.
const NUMBERS: NumberField[] = [
  {
    label: 'Chart View Hours',
    min: 1,
    max: 8,
    get: (c) => c.chartViewHours,
    set: (c, v) => ({ ...c, chartViewHours: v }),
  },
  {
    label: 'Chart Plot Hours',
    min: 1,
    max: 12,
    get: (c) => c.chartPlotHours,
    set: (c, v) => ({ ...c, chartPlotHours: v }),
  },
  {
    label: 'Inter Section Distance Factor',
    min: 1,
    max: 5,
    step: 0.1,
    get: (c) => c.stationSpacing.interSectionFactor,
    set: (c, v) => ({ ...c, stationSpacing: { ...c.stationSpacing, interSectionFactor: v } }),
  },
  {
    label: 'Train Labels Font Size',
    min: 6,
    max: 20,
    get: (c) => c.trainLabels.fontSize,
    set: (c, v) => ({ ...c, trainLabels: { ...c.trainLabels, fontSize: v } }),
  },
  {
    label: 'Forecast Hour',
    min: 1,
    max: 4,
    get: (c) => c.forecast.forecastHours,
    set: (c, v) => ({ ...c, forecast: { ...c.forecast, forecastHours: v } }),
  },
  {
    label: 'Forecast Past Time (min)',
    min: 10,
    max: 600,
    get: (c) => c.forecast.forecastPastMinutes,
    set: (c, v) => ({ ...c, forecast: { ...c.forecast, forecastPastMinutes: v } }),
  },
  {
    label: 'Forecast Opacity',
    min: 0,
    max: 1,
    step: 0.1,
    get: (c) => c.forecast.opacity,
    set: (c, v) => ({ ...c, forecast: { ...c.forecast, opacity: v } }),
  },
  {
    label: 'Crew duty alert (hours)',
    min: 1,
    max: 24,
    get: (c) => c.crew.dutyAlertHours,
    set: (c, v) => ({ ...c, crew: { ...c.crew, dutyAlertHours: v } }),
  },
  {
    label: 'Crew blink every (s)',
    min: 10,
    max: 600,
    get: (c) => c.crew.blinkIntervalSeconds,
    set: (c, v) => ({ ...c, crew: { ...c.crew, blinkIntervalSeconds: v } }),
  },
  {
    label: 'Crew blink for (s)',
    min: 1,
    max: 60,
    get: (c) => c.crew.blinkDurationSeconds,
    set: (c, v) => ({ ...c, crew: { ...c.crew, blinkDurationSeconds: v } }),
  },
];

const BOOLS: BoolField[] = [
  {
    label: 'Show Last Train Label',
    get: (c) => c.trainLabels.showLastTrainLabel,
    set: (c, v) => ({ ...c, trainLabels: { ...c.trainLabels, showLastTrainLabel: v } }),
  },
  {
    label: 'Chart View Crew Details',
    get: (c) => c.crew.chartViewCrewDetails,
    set: (c, v) => ({ ...c, crew: { ...c.crew, chartViewCrewDetails: v } }),
  },
  {
    label: 'Is Coloured Forecast',
    get: (c) => c.forecast.coloured,
    set: (c, v) => ({ ...c, forecast: { ...c.forecast, coloured: v } }),
  },
];

/** Chart preferences (manual §3.1.2 Chart, §3.1.3 Forecast). Kept for this session only. */
export function SettingsDialog({ config, onApply, onClose }: SettingsDialogProps) {
  const [draft, setDraft] = useState(config);
  return (
    <FloatingPanel title="Chart preferences" onClose={onClose} className="settings-dialog">
      <div className="settings-grid">
        {NUMBERS.map((f) => (
          <label key={f.label}>
            <span>{f.label}</span>
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step ?? 1}
              value={f.get(draft)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setDraft(f.set(draft, Math.min(f.max, Math.max(f.min, v))));
              }}
            />
          </label>
        ))}
        {BOOLS.map((f) => (
          <label key={f.label} className="settings-check">
            <input
              type="checkbox"
              checked={f.get(draft)}
              onChange={(e) => {
                setDraft(f.set(draft, e.target.checked));
              }}
            />
            <span>{f.label}</span>
          </label>
        ))}
        <label>
          <span>Default Forecast Colour</span>
          <input
            type="text"
            value={draft.forecast.defaultColour}
            onChange={(e) => {
              setDraft({ ...draft, forecast: { ...draft.forecast, defaultColour: e.target.value } });
            }}
          />
        </label>
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </FloatingPanel>
  );
}
