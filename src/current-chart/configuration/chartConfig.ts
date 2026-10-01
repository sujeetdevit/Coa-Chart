/**
 * Current Chart configuration. Defaults come from the manual (§3.1 Preferences) unless noted.
 * One place for every tunable the chart uses; components never hard-code these values.
 */
export interface ChartConfig {
  /** Hours visible on the chart at a time (manual "Chart View Hours", default 3). */
  chartViewHours: number;
  /** Hours of completed movement shown before "now" (manual "Chart Plot Hours", default 2). */
  chartPlotHours: number;
  /** Vertical grid interval in minutes (manual: time interval is 10 minutes). */
  timeGridMinutes: number;
  /**
   * Events reported this many hours before the snapshot time are treated as stale: reported in
   * diagnostics and excluded from the pannable time range. Not from the manual; a data-hygiene guard.
   */
  staleEventHours: number;
  stationSpacing: StationSpacingConfig;
  zoomLimits: ZoomLimits;
}

/** Interaction limits; not specified by the manual. */
export interface ZoomLimits {
  /** Maximum horizontal magnification, in pixels per minute. */
  maxPxPerMinute: number;
  /** Maximum vertical magnification relative to fitting the whole board in the plot height. */
  maxStationZoom: number;
}

export interface StationSpacingConfig {
  /**
   * Display distance between adjacent stations is clamped to this range so very short or very
   * long block sections stay readable. Source: legacy implementation (manual is silent).
   */
  minGap: number;
  maxGap: number;
  /** Fixed gap for stations of class X / OTHER. Source: legacy implementation. */
  compactGap: number;
  /** Multiplier on the gap between adjacent sections (manual "Inter Section Distance Factor", 1.5). */
  interSectionFactor: number;
  /** Empty space above the first and below the last station, in display-distance units. */
  edgePadding: number;
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  chartViewHours: 3,
  chartPlotHours: 2,
  timeGridMinutes: 10,
  staleEventHours: 48,
  stationSpacing: {
    minGap: 4,
    maxGap: 15,
    compactGap: 2,
    interSectionFactor: 1.5,
    edgePadding: 3,
  },
  zoomLimits: {
    maxPxPerMinute: 40,
    maxStationZoom: 8,
  },
};
