/** Settings for loading chart data from the COA chart API. */
export interface ApiConfig {
  /** Division code sent as Dvsn on every call. */
  dvsn: string;
  /** Board sent on every call. */
  boardId: number;
  /** Sent as UserID / UserIP on the movement call. */
  userId: string;
  userIp: string;
  /** Hours before "now" at the start of the requested window. */
  windowBeforeNowHours: number;
  /** Hours after "now" at the end of the requested window. */
  windowAfterNowHours: number;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  dvsn: 'DNR',
  boardId: 2,
  userId: 'COACHART',
  userIp: '127.0.0.1',
  windowBeforeNowHours: 24,
  windowAfterNowHours: 12,
};
