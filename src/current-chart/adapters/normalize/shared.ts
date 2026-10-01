import type { Direction, EventSource, LineDirection, TrainCategory } from '../../domain';

export function emptyToUndefined(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Parses an integer minute value supplied as text ("3", "-1"); blank or non-numeric → undefined. */
export function parseMinutes(value: string | null): number | undefined {
  const text = emptyToUndefined(value);
  if (text === undefined || !/^-?\d+$/.test(text)) return undefined;
  return Number(text);
}

export function parseDirection(value: string): Direction | undefined {
  return value === 'UP' || value === 'DN' ? value : undefined;
}

export function parseLineDirection(value: string): LineDirection | undefined {
  return value === 'UP' || value === 'DN' || value === 'BOTH' ? value : undefined;
}

export function parseCategory(pgFlag: string): TrainCategory | undefined {
  if (pgFlag === 'G') return 'GOODS';
  if (pgFlag === 'P') return 'PASSENGER';
  if (pgFlag === 'O') return 'OTHER';
  return undefined;
}

/** Reporting user → source. GPSDATA = RTIS, REMLOT = REMLOT, any other user = manual entry. */
export function parseEventSource(userId: string | null): EventSource | undefined {
  const user = emptyToUndefined(userId);
  if (user === undefined) return undefined;
  if (user === 'GPSDATA') return 'RTIS';
  if (user === 'REMLOT') return 'REMLOT';
  return 'MANUAL';
}

/**
 * Drops undefined values so optional properties are absent rather than `undefined`
 * (required by exactOptionalPropertyTypes). Spread the result into the target object.
 */
export function defined<T extends object>(obj: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
