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
  /**
   * For snapshots without an explicit time, "now" is the latest report with at least `minEvents`
   * reports in the preceding `windowMinutes`, so a few stray late reports don't move it.
   * Not from the manual; a heuristic for file snapshots. Live API data will carry the server time.
   */
  snapshotTime: { windowMinutes: number; minEvents: number };
  stationSpacing: StationSpacingConfig;
  zoomLimits: ZoomLimits;
  trainLabels: TrainLabelConfig;
  forecast: ForecastDisplayConfig;
  dwellLanes: DwellLaneConfig;
}

export interface TrainLabelConfig {
  /** Manual "Train Labels Font Size", default 10. */
  fontSize: number;
  /** Manual "Show Last Train Label": the floating label at the end of the train line. Default false. */
  showLastTrainLabel: boolean;
  /** Characters per label line before wrapping (legacy wraps long names at 8–10). */
  wrapAt: number;
  maxLines: number;
}

/** Manual §3.1.3 Forecast preferences. */
export interface ForecastDisplayConfig {
  /** "Is Coloured Forecast": draw forecasts in the train colour. Default N. */
  coloured: boolean;
  /** "Default Forecast Colour", used when not coloured. Default Black. */
  defaultColour: string;
  /** "Opacity" of forecast lines, 0–1. Default 1.0. */
  opacity: number;
}

/**
 * Trains standing at the same station at the same time are drawn slightly apart so their dwell
 * lines don't coincide. Source: legacy implementation (manual is silent).
 */
export interface DwellLaneConfig {
  /** Only dwells at least this long get their own lane. */
  minDwellMinutes: number;
  /** Vertical distance between lanes, in pixels. */
  laneOffsetPx: number;
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
  snapshotTime: { windowMinutes: 60, minEvents: 20 },
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
  trainLabels: {
    fontSize: 10,
    showLastTrainLabel: false,
    wrapAt: 10,
    maxLines: 3,
  },
  forecast: {
    coloured: false,
    defaultColour: 'Black',
    opacity: 1,
  },
  dwellLanes: {
    minDwellMinutes: 2,
    laneOffsetPx: 3,
  },
};
