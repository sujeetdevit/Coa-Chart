import type { ChartDataSource, ChartQuery, RawChartSnapshot } from '../types';

export type SnapshotUrls = Record<keyof RawChartSnapshot, string>;

/**
 * Loads the supplied JSON snapshot files over HTTP. The query is ignored: each file is a fixed
 * snapshot. Payloads are returned unvalidated; validation happens in the adapters.
 */
export class JsonFileDataSource implements ChartDataSource {
  readonly name = 'json-files';

  constructor(
    private readonly urls: SnapshotUrls,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async load(_query: ChartQuery, signal?: AbortSignal): Promise<RawChartSnapshot> {
    const keys = Object.keys(this.urls) as (keyof RawChartSnapshot)[];
    const init: RequestInit = signal ? { signal } : {};
    const payloads = await Promise.all(
      keys.map(async (key) => {
        const url = this.urls[key];
        const response = await this.fetchFn(url, init);
        if (!response.ok) {
          throw new Error(`Failed to load ${key} from ${url}: HTTP ${response.status}`);
        }
        return [key, (await response.json()) as unknown] as const;
      }),
    );
    return Object.fromEntries(payloads) as unknown as RawChartSnapshot;
  }
}
