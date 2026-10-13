import type { ChartDisplayOptions } from '../../current-chart/application/displayOptions';
import type { TrainFilters } from '../../current-chart/application/trainFilters';
import type { TrainCategory } from '../../current-chart/domain';

export type ChartTool = 'pan' | 'zoom';
export type ChartPanel = 'legend' | 'summary' | undefined;

interface ChartToolbarProps {
  options: ChartDisplayOptions;
  onOptionsChange: (options: ChartDisplayOptions) => void;
  filters: TrainFilters;
  onFiltersChange: (filters: TrainFilters) => void;
  tool: ChartTool;
  onToolChange: (tool: ChartTool) => void;
  msm: boolean;
  onMsmChange: (on: boolean) => void;
  frozen: boolean;
  hasPending: boolean;
  onFrozenChange: (frozen: boolean) => void;
  panel: ChartPanel;
  onPanelChange: (panel: ChartPanel) => void;
}

const DISPLAY: { key: keyof ChartDisplayOptions; label: string; title: string }[] = [
  { key: 'showCrew', label: 'Crew', title: 'Crew details on the train label' },
  {
    key: 'highlightGps',
    label: 'GPS Loco',
    title: 'Highlight GPS-loco enabled trains (RTIS / REMLOT reported)',
  },
  { key: 'showSpeed', label: 'Speed', title: 'Speed at each departure' },
  { key: 'showGainLoss', label: 'Gain/Loss', title: 'Detention in red, gain in green' },
  {
    key: 'showLastTrainLabel',
    label: 'Last label',
    title: 'Floating train label at the end of each train line',
  },
];

/** The side columns that can be switched off to give the chart more room. */
const COLUMNS: { key: keyof ChartDisplayOptions; label: string; title: string }[] = [
  { key: 'showCautionColumn', label: 'Caution', title: 'Show the caution column on the right' },
  { key: 'showLineColumn', label: 'Lines', title: 'Show the line occupancy column on the right' },
  { key: 'showUnusualColumn', label: 'Unusual', title: 'Show the unusual occurrences column on the right' },
];

const CATEGORIES: { key: TrainCategory; label: string }[] = [
  { key: 'GOODS', label: 'Goods' },
  { key: 'PASSENGER', label: 'Pass' },
  { key: 'OTHER', label: 'Others' },
];

/** Manual §11.1 chart controls. */
export function ChartToolbar(props: ChartToolbarProps) {
  const { options, filters } = props;
  return (
    <div className="chart-toolbar" role="toolbar" aria-label="Chart controls">
      <span className="toggles">
        {DISPLAY.map(({ key, label, title }) => (
          <label key={key} title={title}>
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => {
                props.onOptionsChange({ ...options, [key]: e.target.checked });
              }}
            />
            {label}
          </label>
        ))}
      </span>

      <span className="toggles" title="View only the ticked train types (none ticked: all)">
        {CATEGORIES.map(({ key, label }) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={filters.categories[key]}
              onChange={(e) => {
                props.onFiltersChange({
                  ...filters,
                  categories: { ...filters.categories, [key]: e.target.checked },
                });
              }}
            />
            {label}
          </label>
        ))}
      </span>

      <span className="toggles" role="radiogroup" aria-label="Direction">
        {(['ALL', 'UP', 'DN'] as const).map((direction) => (
          <label key={direction}>
            <input
              type="radio"
              name="direction"
              checked={filters.direction === direction}
              onChange={() => {
                props.onFiltersChange({ ...filters, direction });
              }}
            />
            {direction === 'ALL' ? 'All' : direction}
          </label>
        ))}
      </span>

      <span className="toggles">
        <label title="Drag a rectangle on the chart to zoom into it">
          <input
            type="checkbox"
            checked={props.tool === 'zoom'}
            onChange={(e) => {
              props.onToolChange(e.target.checked ? 'zoom' : 'pan');
            }}
          />
          Zoom
        </label>
        <label title="Click a traversed block section to see its mid-section plot">
          <input
            type="checkbox"
            checked={props.msm}
            onChange={(e) => {
              props.onMsmChange(e.target.checked);
            }}
          />
          MSM
        </label>
        <label title="Unattached GPS loco movement: no data source supplied">
          <input type="checkbox" disabled />
          GPS Loco Mvmt
        </label>
        <label title="Stop chart updates while you analyse it" className={props.frozen ? 'frozen' : ''}>
          <input
            type="checkbox"
            checked={props.frozen}
            onChange={(e) => {
              props.onFrozenChange(e.target.checked);
            }}
          />
          Freeze{props.hasPending ? ' (updates waiting)' : ''}
        </label>
      </span>

      <span className="button-group">
        <button
          type="button"
          aria-pressed={props.panel === 'legend'}
          title="Legends: train types, icons, line occupancy"
          onClick={() => {
            props.onPanelChange(props.panel === 'legend' ? undefined : 'legend');
          }}
        >
          L
        </button>
        <button
          type="button"
          aria-pressed={props.panel === 'summary'}
          title="Summary of trains taken over and handed over"
          onClick={() => {
            props.onPanelChange(props.panel === 'summary' ? undefined : 'summary');
          }}
        >
          S
        </button>
      </span>

      <span className="toggles side-columns" aria-label="Side columns">
        {COLUMNS.map(({ key, label, title }) => (
          <label key={key} title={title}>
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => {
                props.onOptionsChange({ ...options, [key]: e.target.checked });
              }}
            />
            {label}
          </label>
        ))}
      </span>
    </div>
  );
}
