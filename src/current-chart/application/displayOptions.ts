import type { ChartConfig } from '../configuration/chartConfig';

/** User-toggled display state for the chart (toolbar checkboxes). */
export interface ChartDisplayOptions {
  /** Manual "Gain/Loss" checkbox: detention in red, gain in green. */
  showGainLoss: boolean;
  /** Manual "Speed" checkbox. */
  showSpeed: boolean;
  /** Manual preference "Show Last Train Label". */
  showLastTrainLabel: boolean;
}

export function defaultDisplayOptions(config: ChartConfig): ChartDisplayOptions {
  return {
    showGainLoss: false,
    showSpeed: false,
    showLastTrainLabel: config.trainLabels.showLastTrainLabel,
  };
}
