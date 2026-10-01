import { z } from 'zod';
import type {
  ForecastProvider,
  ForecastRequest,
  ForecastResult,
} from '../../application/forecast/ForecastProvider';
import type { EpochMs, ForecastPoint, TrainForecast } from '../../domain';
import { parseCoaDateTime } from '../shared/coaDateTime';

const sampleSchema = z.object({
  note: z.string(),
  trains: z.array(
    z.object({
      trainId: z.string(),
      points: z.array(
        z.object({
          station: z.string(),
          section: z.number(),
          arrival: z.string().optional(),
          departure: z.string().optional(),
        }),
      ),
    }),
  ),
});

const SAMPLE_NOTE =
  'Sample forecast — not the COA forecast algorithm (generated from observed running times).';

/**
 * Forecast provider backed by a pre-generated sample file (src/data/forecast.sample.json,
 * see scripts/gen_forecast_sample.py). For UI development only: BF and FF return the same
 * sample paths; halts are not applied; CMI keeps the manual forecast; WFS is kept in memory.
 */
export class SampleForecastProvider implements ForecastProvider {
  readonly source = 'sample' as const;
  private forecasts: Promise<Map<string, TrainForecast>> | undefined;
  readonly wrongForecastReports: { at: EpochMs; trainCount: number }[] = [];

  constructor(private readonly load: () => Promise<unknown>) {}

  private all(): Promise<Map<string, TrainForecast>> {
    this.forecasts ??= this.load().then(parseSample);
    return this.forecasts;
  }

  private async pick(request: ForecastRequest, kind: TrainForecast['kind']): Promise<ForecastResult> {
    const all = await this.all();
    const ids = request.trainIds ?? [...all.keys()];
    const forecasts = new Map<string, TrainForecast>();
    for (const id of ids) {
      const f = all.get(id);
      if (f) forecasts.set(id, { kind, points: f.points });
    }
    const halts =
      request.halts.length > 0 ? ` ${request.halts.length} halt(s) not applied by the sample.` : '';
    const none = forecasts.size === 0 ? ' No sample forecast for this train.' : '';
    return { forecasts, source: 'sample', message: `${SAMPLE_NOTE}${halts}${none}` };
  }

  basic(request: ForecastRequest): Promise<ForecastResult> {
    return this.pick(request, 'BASIC');
  }

  full(request: ForecastRequest): Promise<ForecastResult> {
    return this.pick(request, 'FULL');
  }

  single(request: ForecastRequest & { trainIds: [string] }): Promise<ForecastResult> {
    return this.pick(request, 'SINGLE');
  }

  confirmManualIntervention(
    request: ForecastRequest & { manual: ReadonlyMap<string, TrainForecast> },
  ): Promise<ForecastResult> {
    return Promise.resolve({
      forecasts: request.manual,
      source: 'sample',
      message:
        'CMI needs the COA forecast server to regenerate the full forecast; the manual forecast is kept.',
    });
  }

  reportWrongForecast(snapshot: {
    at: EpochMs;
    forecasts: ReadonlyMap<string, TrainForecast>;
  }): Promise<{ saved: boolean; message: string }> {
    this.wrongForecastReports.push({ at: snapshot.at, trainCount: snapshot.forecasts.size });
    return Promise.resolve({
      saved: true,
      message: `Wrong forecast recorded for ${snapshot.forecasts.size} train(s) (kept in this session only).`,
    });
  }
}

export function parseSample(raw: unknown): Map<string, TrainForecast> {
  const doc = sampleSchema.parse(raw);
  const result = new Map<string, TrainForecast>();
  for (const train of doc.trains) {
    const points: ForecastPoint[] = train.points.map((p) => {
      const point: ForecastPoint = { stationCode: p.station, sectionId: p.section };
      const arrival = parseCoaDateTime(p.arrival);
      const departure = parseCoaDateTime(p.departure);
      if (arrival !== undefined) point.arrival = arrival;
      if (departure !== undefined) point.departure = departure;
      return point;
    });
    result.set(train.trainId, { kind: 'FULL', points });
  }
  return result;
}
