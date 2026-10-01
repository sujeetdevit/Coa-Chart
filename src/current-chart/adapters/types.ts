import type { EpochMs } from '../domain';

/** What the chart is asking for. A JSON snapshot source may ignore parts of it. */
export interface ChartQuery {
  boardId?: number;
  from?: EpochMs;
  to?: EpochMs;
}

/**
 * Unvalidated payloads, one per source dataset. Field shapes match the COA chart API responses,
 * so the JSON-file source and a future HTTP source can share the same adapters.
 */
export interface RawChartSnapshot {
  movement: unknown;
  boardDetails: unknown;
  stationLines: unknown;
  crew: unknown;
  loco: unknown;
  remarks: unknown;
  blocks: unknown;
  cautions: unknown;
}

export interface ChartDataSource {
  readonly name: string;
  load(query: ChartQuery, signal?: AbortSignal): Promise<RawChartSnapshot>;
}
