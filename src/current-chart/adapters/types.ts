import type { EpochMs } from '../domain';

/** What the chart is asking for. A JSON snapshot source may ignore parts of it. */
export interface ChartQuery {
  boardId?: number;
  from?: EpochMs;
  to?: EpochMs;
}

/** The source datasets a snapshot is made of. */
export const DATASET_KEYS = [
  'movement',
  'boardDetails',
  'stationLines',
  'crew',
  'loco',
  'remarks',
  'blocks',
  'cautions',
] as const;

export type DatasetKey = (typeof DATASET_KEYS)[number];

/**
 * Datasets without which no chart can be drawn (the station axis). A source must fail the whole
 * load when one of these is unavailable; any other dataset may fail on its own.
 */
export const REQUIRED_DATASETS: readonly DatasetKey[] = ['boardDetails', 'stationLines'];

/**
 * Unvalidated payloads, one per source dataset. Field shapes match the COA chart API responses,
 * so the JSON-file source and a future HTTP source can share the same adapters.
 */
export type RawChartSnapshot = Record<DatasetKey, unknown> & {
  /**
   * Datasets the source could not load, with the reason. Their payload is an empty array; the
   * adapters report each one so the chart is drawn without that data rather than not at all.
   */
  loadErrors?: Partial<Record<DatasetKey, string>>;
};

/**
 * Where chart data comes from. Implement this to plug in an API: return the same row shapes as
 * the supplied JSON files and everything downstream (validation, adapters, chart) is unchanged.
 */
export interface ChartDataSource {
  readonly name: string;
  /**
   * Loads every dataset. Rejects only when a required dataset is unavailable (or on abort);
   * other failures are reported in `loadErrors`. Returning the very same payload object as the
   * previous load tells callers that dataset has not changed.
   */
  load(query: ChartQuery, signal?: AbortSignal): Promise<RawChartSnapshot>;
}
