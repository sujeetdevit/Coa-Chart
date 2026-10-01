import type { EpochMs } from '../../domain';

/** COA timestamps are Indian Standard Time wall-clock values (UTC+05:30, no DST). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

const PATTERN = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses `dd-mm-yy HH:mm[:ss]` (also accepts a 4-digit year) as IST.
 * Returns undefined for null, empty or malformed input, including impossible dates like 31-02.
 */
export function parseCoaDateTime(value: string | null | undefined): EpochMs | undefined {
  if (value == null) return undefined;
  const match = PATTERN.exec(value.trim());
  if (!match) return undefined;

  const [, dd, mm, yy, hh, mi, ss] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = yy?.length === 2 ? 2000 + Number(yy) : Number(yy);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = ss === undefined ? 0 : Number(ss);

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return undefined;

  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Date.UTC rolls invalid days over (31-02 → 03-03); reject those.
  if (new Date(utc).getUTCDate() !== day) return undefined;

  return utc - IST_OFFSET_MS;
}

/** Formats an epoch time as IST `dd-mm-yyyy HH:mm:ss`, for tooltips and diagnostics. */
export function formatCoaDateTime(ms: EpochMs): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}
