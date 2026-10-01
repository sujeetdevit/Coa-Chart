import type { StationSpacingConfig } from '../configuration/chartConfig';
import type { Board, Station, StationId } from '../domain';

export interface StationPosition {
  station: Station;
  /** Vertical position in display-distance units from the top of the layout. */
  offset: number;
}

/** Vertical layout of the board's stations in display-distance units, independent of pixels. */
export interface StationLayout {
  /** In display order (top to bottom); offsets are non-decreasing. */
  positions: StationPosition[];
  byId: ReadonlyMap<StationId, StationPosition>;
  /** Total height in units, including edge padding. */
  totalUnits: number;
}

/**
 * Gap between a station and the one above it. The source's display distance is clamped so short
 * and long block sections stay readable, and the gap across a section change is widened.
 */
function gapAbove(station: Station, previous: Station, config: StationSpacingConfig): number {
  const base =
    station.kind === 'OTHER'
      ? config.compactGap
      : Math.min(config.maxGap, Math.max(config.minGap, station.displayDistance));
  return station.sectionId === previous.sectionId ? base : base * config.interSectionFactor;
}

export function buildStationLayout(board: Board, config: StationSpacingConfig): StationLayout {
  const positions: StationPosition[] = [];
  let offset = config.edgePadding;
  let previous: Station | undefined;
  for (const station of board.stations) {
    if (previous) offset += gapAbove(station, previous, config);
    positions.push({ station, offset });
    previous = station;
  }
  const last = positions[positions.length - 1];
  return {
    positions,
    byId: new Map(positions.map((p) => [p.station.id, p])),
    totalUnits: (last?.offset ?? 0) + config.edgePadding,
  };
}

/** Index of the position whose offset is nearest to `offset` (binary search). -1 if empty. */
export function nearestPositionIndex(layout: StationLayout, offset: number): number {
  const { positions } = layout;
  if (positions.length === 0) return -1;
  let lo = 0;
  let hi = positions.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((positions[mid]?.offset ?? 0) < offset) lo = mid + 1;
    else hi = mid;
  }
  const below = positions[lo]?.offset ?? 0;
  const above = positions[lo - 1]?.offset;
  return above !== undefined && offset - above <= below - offset ? lo - 1 : lo;
}
