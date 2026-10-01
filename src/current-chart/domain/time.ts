/** Milliseconds since the Unix epoch. All domain timestamps use this; adapters do the parsing. */
export type EpochMs = number;

export interface TimeRange {
  start: EpochMs;
  end: EpochMs;
}

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
