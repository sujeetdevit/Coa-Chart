import type { Caution, ChartLocation, EpochMs, LineDirection } from '../domain';

/** Cautions at one location in one direction share an icon (legacy grouping). */
export interface CautionGroup {
  key: string;
  location: ChartLocation;
  direction: LineDirection;
  cautions: Caution[];
  /** Most restrictive speeds in the group, for the icon text ("P30 G45"). */
  passengerSpeed?: number;
  goodsSpeed?: number;
}

export function locationKey(location: ChartLocation): string {
  return location.kind === 'station'
    ? `${location.sectionId}:${location.stationCode}`
    : `${location.sectionId}:${location.fromStationCode}-${location.toStationCode}`;
}

export function isCautionInForce(caution: Caution, at: EpochMs): boolean {
  return caution.from <= at && (caution.to === undefined || caution.to > at);
}

function minDefined(values: (number | undefined)[]): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length > 0 ? Math.min(...defined) : undefined;
}

/** Cautions in force at `at`, grouped by location and direction. */
export function activeCautionGroups(cautions: Caution[], at: EpochMs): CautionGroup[] {
  const groups = new Map<string, CautionGroup>();
  for (const caution of cautions) {
    if (!isCautionInForce(caution, at)) continue;
    const key = `${locationKey(caution.location)}#${caution.direction}`;
    const group = groups.get(key) ?? {
      key,
      location: caution.location,
      direction: caution.direction,
      cautions: [],
    };
    group.cautions.push(caution);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const p = minDefined(group.cautions.map((c) => c.passengerSpeed));
    const g = minDefined(group.cautions.map((c) => c.goodsSpeed));
    if (p !== undefined) group.passengerSpeed = p;
    if (g !== undefined) group.goodsSpeed = g;
  }
  return [...groups.values()];
}

/** Icon caption, e.g. "P30 G45"; empty when no speeds are given. */
export function cautionSpeedText(group: CautionGroup): string {
  return [
    group.passengerSpeed !== undefined ? `P${group.passengerSpeed}` : '',
    group.goodsSpeed !== undefined ? `G${group.goodsSpeed}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
