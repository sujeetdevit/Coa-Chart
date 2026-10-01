/** Milliseconds since the Unix epoch. All domain timestamps use this; adapters do the parsing. */
export type EpochMs = number;

export interface TimeRange {
  start: EpochMs;
  end: EpochMs;
}

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** COA times are Indian Standard Time: UTC+05:30, no daylight saving. */
export const IST_OFFSET_MS = 5 * MS_PER_HOUR + 30 * MS_PER_MINUTE;

/** IST wall-clock fields of an epoch time. */
export function istClock(ms: EpochMs): {
  hour: number;
  minute: number;
  day: number;
  month: number;
  year: number;
} {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}
