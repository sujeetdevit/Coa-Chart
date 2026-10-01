import type { ForecastDisplayConfig } from '../../configuration/chartConfig';
import {
  MS_PER_HOUR,
  MS_PER_MINUTE,
  type CurrentChartModel,
  type EpochMs,
  type ForecastPoint,
  type Train,
  type TrainForecast,
} from '../../domain';

function lastReportedTime(train: Train): EpochMs | undefined {
  let latest: EpochMs | undefined;
  for (const e of train.events) {
    for (const t of [e.arrival, e.departure])
      if (t !== undefined && (latest === undefined || t > latest)) latest = t;
  }
  return latest;
}

/** Keeps forecast points up to the forecast horizon; a point straddling it keeps only its arrival. */
function truncate(points: ForecastPoint[], horizon: EpochMs): ForecastPoint[] {
  const kept: ForecastPoint[] = [];
  for (const point of points) {
    const first = point.arrival ?? point.departure;
    if (first === undefined || first > horizon) break;
    if (point.departure !== undefined && point.departure > horizon) {
      const arrivalOnly: ForecastPoint = { stationCode: point.stationCode, sectionId: point.sectionId };
      if (point.arrival !== undefined) arrivalOnly.arrival = point.arrival;
      kept.push(arrivalOnly);
      break;
    }
    kept.push(point);
  }
  return kept;
}

/**
 * Attaches forecasts to the model's trains for display, applying the manual's forecast
 * preferences: only trains last reported within "Forecast Past Time" get one, and points beyond
 * "Forecast Hour" from now are dropped.
 */
export function withForecasts(
  model: CurrentChartModel,
  forecasts: ReadonlyMap<string, TrainForecast>,
  now: EpochMs,
  config: ForecastDisplayConfig,
): CurrentChartModel {
  if (forecasts.size === 0) return model;
  const horizon = now + config.forecastHours * MS_PER_HOUR;
  const earliest = now - config.forecastPastMinutes * MS_PER_MINUTE;
  return {
    ...model,
    trains: model.trains.map((train) => {
      const forecast = forecasts.get(train.id);
      if (!forecast) return train;
      const reported = lastReportedTime(train);
      if (reported === undefined || reported < earliest) return train;
      const points = truncate(forecast.points, horizon);
      return points.length > 0 ? { ...train, forecast: { kind: forecast.kind, points } } : train;
    }),
  };
}
