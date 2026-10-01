import type { ChartConfig } from '../configuration/chartConfig';
import { MS_PER_HOUR, MS_PER_MINUTE, type CurrentChartModel, type EpochMs, type TimeRange } from '../domain';

/**
 * Initial visible window: starts "Chart Plot Hours" before now and spans "Chart View Hours",
 * so with the defaults (2 and 3) it shows 2 h of history and 1 h ahead for forecasts.
 * The start is floored to the time-grid interval so the axis begins on a grid line.
 *
 * This reading of the two manual parameters is an assumption (see the discovery doc, C12).
 */
export function initialTimeWindow(now: EpochMs, config: ChartConfig): TimeRange {
  const grid = config.timeGridMinutes * MS_PER_MINUTE;
  const start = Math.floor((now - config.chartPlotHours * MS_PER_HOUR) / grid) * grid;
  return { start, end: start + config.chartViewHours * MS_PER_HOUR };
}

/**
 * Time range the user may pan across: the earliest reported event in the snapshot (ignoring
 * trains flagged stale) up to the end of the initial window, and never narrower than that window.
 */
export function pannableTimeExtent(
  model: CurrentChartModel,
  window: TimeRange,
  config: ChartConfig,
): TimeRange {
  const staleBefore = model.asOf - config.staleEventHours * MS_PER_HOUR;
  let earliest = window.start;
  for (const train of model.trains) {
    for (const event of train.events) {
      for (const t of [event.arrival, event.departure]) {
        if (t !== undefined && t >= staleBefore && t < earliest) earliest = t;
      }
    }
  }
  return { start: earliest, end: Math.max(window.end, model.asOf) };
}
