import type { ChartLocation, CurrentChartModel, EpochMs, TrainForecast } from '../../domain';

/** A manual intervention entered in the "Train Manual Halt" form (manual §11.1.2). */
export interface ManualHalt {
  trainId: string;
  /** "Halt on Station" or "Delay in Block section". */
  location: ChartLocation;
  minutes: number;
}

export interface ForecastRequest {
  model: CurrentChartModel;
  /** Limit to these trains (single forecast); all trains otherwise. */
  trainIds?: string[];
  halts: ManualHalt[];
}

export type ForecastSource = 'server' | 'sample' | 'none';

export interface ForecastResult {
  forecasts: ReadonlyMap<string, TrainForecast>;
  source: ForecastSource;
  /** Shown to the user, e.g. why a command is not available. */
  message?: string;
}

/**
 * Where forecasts come from. The manual's Basic and Full Forecast, CMI and WFS run against the
 * COA server's pipeline data (NRT, occupancy, group priority, halts). The chart only displays
 * results; it never computes a forecast itself.
 */
export interface ForecastProvider {
  readonly source: ForecastSource;
  /** BF: basic forecast of the trains visible on the chart. */
  basic(request: ForecastRequest): Promise<ForecastResult>;
  /** FF: full forecast, applying halts entered via the Halt form. */
  full(request: ForecastRequest): Promise<ForecastResult>;
  /** Right-click a train label → Forecast. */
  single(request: ForecastRequest & { trainIds: [string] }): Promise<ForecastResult>;
  /** CMI: confirm manual interventions (precedence/crossing) and regenerate the full forecast. */
  confirmManualIntervention(
    request: ForecastRequest & { manual: ReadonlyMap<string, TrainForecast> },
  ): Promise<ForecastResult>;
  /** WFS: save the forecast currently shown, flagged as wrong, for analysis. */
  reportWrongForecast(snapshot: {
    at: EpochMs;
    forecasts: ReadonlyMap<string, TrainForecast>;
  }): Promise<{ saved: boolean; message: string }>;
}
