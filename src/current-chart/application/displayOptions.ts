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
}

export function defaultDisplayOptions(config: ChartConfig): ChartDisplayOptions {
  return {
    showCrew: false,
    highlightGps: false,
    showGainLoss: false,
    showSpeed: false,
    showLastTrainLabel: config.trainLabels.showLastTrainLabel,
  };
}
