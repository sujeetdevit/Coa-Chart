import type { ChartConfig } from '../configuration/chartConfig';

/** User-toggled display state for the chart (toolbar checkboxes). */
export interface ChartDisplayOptions {
  /** Manual "Crew" checkbox: crew details on the train label. */
  showCrew: boolean;
  /** Manual "Gps Loco" checkbox: highlight GPS-loco enabled trains. */
  highlightGps: boolean;
  /** Manual "Gain/Loss" checkbox: detention in red, gain in green. */
  showGainLoss: boolean;
  /** Manual "Speed" checkbox. */
  showSpeed: boolean;
  /** Manual preference "Show Last Train Label". */
  showLastTrainLabel: boolean;
  /** The caution column right of the plot. Not from the manual: a way to give the plot more room. */
  showCautionColumn: boolean;
  /** The line-occupancy column right of the plot. Not from the manual, as above. */
  showLineColumn: boolean;
  /** The unusual-occurrences column right of the plot. Not from the manual, as above. */
  showUnusualColumn: boolean;
}

export type SideColumnOptions = Pick<
  ChartDisplayOptions,
  'showCautionColumn' | 'showLineColumn' | 'showUnusualColumn'
>;

/** Every side column shown: how the chart opens, and what a manual refresh goes back to. */
export const ALL_SIDE_COLUMNS: SideColumnOptions = {
  showCautionColumn: true,
  showLineColumn: true,
  showUnusualColumn: true,
};

export function defaultDisplayOptions(config: ChartConfig): ChartDisplayOptions {
  return {
    showCrew: false,
    highlightGps: false,
    showGainLoss: false,
    showSpeed: false,
    showLastTrainLabel: config.trainLabels.showLastTrainLabel,
    ...ALL_SIDE_COLUMNS,
  };
}

/** Widths of the side columns that can be switched off: full width when shown, none when not. */
export function sideColumnWidths(
  options: SideColumnOptions,
  full: { cautionColumn: number; occupancyColumn: number; unusualColumn: number },
): { caution: number; occupancy: number; unusual: number } {
  return {
    caution: options.showCautionColumn ? full.cautionColumn : 0,
    occupancy: options.showLineColumn ? full.occupancyColumn : 0,
    unusual: options.showUnusualColumn ? full.unusualColumn : 0,
  };
}
