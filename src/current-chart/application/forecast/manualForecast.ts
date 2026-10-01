import type { EpochMs, ForecastPoint, TrainForecast } from '../../domain';

/** MF: convert the forecasts shown into editable manual forecasts. */
export function toManual(forecasts: ReadonlyMap<string, TrainForecast>): Map<string, TrainForecast> {
  return new Map(
    [...forecasts].map(([id, f]) => [
      id,
      { kind: 'MANUAL' as const, points: f.points.map((p) => ({ ...p })) },
    ]),
  );
}

/**
 * Manual Forecast drag: sets one forecast time and shifts every later time of that train by the
 * same amount, so the dragged train's running times after the point are kept. The time cannot
 * move before the previous forecast time of the train. Manual forecasts are a visual estimate
 * only and are never saved (manual §11.1.2).
 */
export function moveForecastTime(
  forecast: TrainForecast,
  pointIndex: number,
  field: 'arrival' | 'departure',
  time: EpochMs,
): TrainForecast {
  const point = forecast.points[pointIndex];
  const current = point?.[field];
  if (!point || current === undefined) return forecast;

  const previous = previousTime(forecast.points, pointIndex, field);
  const target = previous !== undefined ? Math.max(time, previous) : time;
  const delta = target - current;
  if (delta === 0) return forecast;

  const shift = (t: EpochMs | undefined) => (t === undefined ? undefined : t + delta);
  const points = forecast.points.map((p, i): ForecastPoint => {
    if (i < pointIndex) return p;
    const moved: ForecastPoint = { stationCode: p.stationCode, sectionId: p.sectionId };
    const arrival = i === pointIndex && field === 'departure' ? p.arrival : shift(p.arrival);
    const departure = shift(p.departure);
    if (arrival !== undefined) moved.arrival = arrival;
    if (departure !== undefined) moved.departure = departure;
    return moved;
  });
  return { kind: 'MANUAL', points };
}

function previousTime(
  points: ForecastPoint[],
  index: number,
  field: 'arrival' | 'departure',
): EpochMs | undefined {
  if (field === 'departure' && points[index]?.arrival !== undefined) return points[index].arrival;
  for (let i = index - 1; i >= 0; i--) {
    const p = points[i];
    const t = p?.departure ?? p?.arrival;
    if (t !== undefined) return t;
  }
  return undefined;
}
