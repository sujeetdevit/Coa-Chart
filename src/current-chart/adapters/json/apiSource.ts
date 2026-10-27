import { DEFAULT_API_CONFIG, type ApiConfig } from '../../configuration/apiConfig';
import type { DatasetKey } from '../types';
import { JsonFileDataSource, type SnapshotUrls } from './JsonFileDataSource';

const HOUR_MS = 3_600_000;

const pad = (n: number): string => String(n).padStart(2, '0');

/** The API's request date format, `dd/MM/yyyy HH:mm:ss`, in local time. */
export function formatApiDateTime(ms: number): string {
  const d = new Date(ms);
  return (
    `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Each endpoint names its parameters differently; this is the name each one uses. */
interface Endpoint {
  path: string;
  division: string;
  board: string;
  from?: string;
  to?: string;
  /** Extra parameters, built from the config. */
  extra?: (config: ApiConfig) => Record<string, string>;
}

const ENDPOINTS: Record<DatasetKey, Endpoint> = {
  boardDetails: { path: 'GetBoardDetails', division: 'Dvsn', board: 'Board' },
  stationLines: {
    path: 'fetchSttnLine',
    division: 'dvsn',
    board: 'boardid',
    from: 'fromtime',
    to: 'totime',
  },
  movement: {
    path: 'GetMvmntDetails',
    division: 'Dvsn',
    board: 'Board',
    from: 'frmDateTime',
    to: 'toDateTime',
    extra: (c) => ({ UserID: c.userId, UserIP: c.userIp }),
  },
  loco: { path: 'GetLocoDetails', division: 'Dvsn', board: 'Board', from: 'frmDateTime', to: 'toDateTime' },
  crew: { path: 'GetCrewDtls', division: 'Dvsn', board: 'Boardid', from: 'frmDateTime', to: 'toDateTime' },
  remarks: { path: 'GetRemrks', division: 'Dvsn', board: 'Board', from: 'frmDateTime', to: 'toDateTime' },
  cautions: {
    path: 'fetchCautionDataonChart',
    division: 'Ctndvsn',
    board: 'Ctnboardid',
    from: 'frmDateTime',
    to: 'toDateTime',
  },
  blocks: {
    path: 'getBlockdataonCharts',
    division: 'blkdvsn',
    board: 'blkboardid',
    from: 'frmDateTime',
    to: 'toDateTime',
  },
};

/**
 * One URL per dataset. The time window is worked out at each call from the config (before and
 * after "now"), unless the query carries its own `from` / `to`.
 */
export function apiSnapshotUrls(
  baseUrl: string,
  config: ApiConfig = DEFAULT_API_CONFIG,
  now: () => number = Date.now,
): SnapshotUrls {
  const base = baseUrl.replace(/\/+$/, '');
  const urls = {} as SnapshotUrls;
  for (const key of Object.keys(ENDPOINTS) as DatasetKey[]) {
    const endpoint = ENDPOINTS[key];
    urls[key] = (query) => {
      const params = new URLSearchParams();
      params.set(endpoint.division, config.dvsn);
      params.set(endpoint.board, String(query.boardId ?? config.boardId));
      if (endpoint.from !== undefined && endpoint.to !== undefined) {
        const at = now();
        params.set(
          endpoint.from,
          formatApiDateTime(query.from ?? at - config.windowBeforeNowHours * HOUR_MS),
        );
        params.set(endpoint.to, formatApiDateTime(query.to ?? at + config.windowAfterNowHours * HOUR_MS));
      }
      for (const [name, value] of Object.entries(endpoint.extra?.(config) ?? {})) params.set(name, value);
      return `${base}/${endpoint.path}?${params.toString()}`;
    };
  }
  return urls;
}

/**
 * Chart data from the COA chart API: one JSON endpoint per dataset, in the row shapes of the
 * supplied files. The API answers XML unless asked for JSON, so every call sends `Accept`.
 */
export function createApiSource(baseUrl: string, config: ApiConfig = DEFAULT_API_CONFIG): JsonFileDataSource {
  return new JsonFileDataSource(apiSnapshotUrls(baseUrl, config), (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    return fetch(input, { ...init, headers });
  });
}
