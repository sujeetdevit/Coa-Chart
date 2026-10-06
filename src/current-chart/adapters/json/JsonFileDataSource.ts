import {
  DATASET_KEYS,
  REQUIRED_DATASETS,
  type ChartDataSource,
  type ChartQuery,
  type DatasetKey,
  type RawChartSnapshot,
} from '../types';

/** One URL per dataset, fixed or built from the query (for an API that takes board and time range). */
export type SnapshotUrls = Record<DatasetKey, string | ((query: ChartQuery) => string)>;

interface Cached {
  text: string;
  payload: unknown;
}

/**
 * Loads one JSON document per dataset over HTTP: the supplied snapshot files today, and any API
 * that serves the same row shapes. Payloads are returned unvalidated; validation happens in the
 * adapters.
 *
 * - A dataset that fails to load is reported in `loadErrors` and returned empty, unless it is a
 *   required one, in which case the load rejects.
 * - A dataset whose response text is unchanged since the last load is returned as the same
 *   object, so callers can tell that nothing changed without comparing megabytes of rows.
 */
export class JsonFileDataSource implements ChartDataSource {
  readonly name = 'json-files';
  private readonly cache = new Map<DatasetKey, Cached>();

  constructor(
    private readonly urls: SnapshotUrls,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async load(query: ChartQuery, signal?: AbortSignal): Promise<RawChartSnapshot> {
    const results = await Promise.allSettled(DATASET_KEYS.map((key) => this.loadDataset(key, query, signal)));
    signal?.throwIfAborted();

    const snapshot = {} as RawChartSnapshot;
    const loadErrors: Partial<Record<DatasetKey, string>> = {};
    DATASET_KEYS.forEach((key, i) => {
      const result = results[i];
      if (result?.status === 'fulfilled') {
        snapshot[key] = result.value;
        return;
      }
      const reason: unknown = result?.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      if (REQUIRED_DATASETS.includes(key)) throw new Error(message);
      snapshot[key] = [];
      loadErrors[key] = message;
    });
    if (Object.keys(loadErrors).length > 0) snapshot.loadErrors = loadErrors;
    return snapshot;
  }

  private async loadDataset(key: DatasetKey, query: ChartQuery, signal?: AbortSignal): Promise<unknown> {
    const target = this.urls[key];
    const url = typeof target === 'function' ? target(query) : target;
    let text: string;
    try {
      const response = await this.fetchFn(url, signal ? { signal } : {});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } catch (error) {
      throw new Error(
        `Failed to load ${key} from ${url}: ${error instanceof Error ? error.message : String(error)}`,
        {
          cause: error,
        },
      );
    }
    const cached = this.cache.get(key);
    if (cached?.text === text) return cached.payload;
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Failed to load ${key} from ${url}: the response is not valid JSON`);
    }
    this.cache.set(key, { text, payload });
    return payload;
  }
}
