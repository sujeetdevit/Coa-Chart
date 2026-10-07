/**
 * Visual constants for the Current Chart. Colours stated by the manual are marked; the rest are
 * presentation choices. Renderers and the render-model builders read from here, never hard-code.
 */
export interface ChartTheme {
  /**
   * Column widths around the plot. Right of the plot, left to right (manual screenshots):
   * station names + km, caution icons, unusual icons, line occupancy.
   */
  layout: ChartLayout;
  /** Derived from `layout`: space around the plot. */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Grid density limits used when zoomed out. */
  tickSpacing: { minLinePx: number; minLabelPx: number };
  fontFamily: string;
  plotBackground: string;
  axisBackground: string;
  /** Manual: the chart up to the current time is shaded. */
  pastShading: string;
  timeAxis: {
    /** Manual: hours in red. */
    hourLabel: string;
    /** Manual: minutes in black. */
    minuteLabel: string;
    hourLabelSize: number;
    minuteLabelSize: number;
    hourLine: string;
    hourLineWidth: number;
    minuteLine: string;
    minuteLineWidth: number;
  };
  stationAxis: {
    /** Manual: stations in black. */
    label: string;
    /** Manual: section entry/exit stations in blue. */
    boundaryLabel: string;
    /** Manual: sidings in red. */
    sidingLabel: string;
    labelSize: number;
    boundaryLabelSize: number;
    kmLabel: string;
    kmLabelSize: number;
    line: string;
    lineWidth: number;
    lineDash: number[];
  };
  movement: MovementTheme;
  overlays: OverlayTheme;
  interaction: {
    hoverWidth: number;
    hoverOpacity: number;
    selectedWidth: number;
    selectedOpacity: number;
    overlayOutline: string;
  };
}

export interface ChartLayout {
  top: number;
  bottom: number;
  left: number;
  stationColumn: number;
  cautionColumn: number;
  unusualColumn: number;
  occupancyColumn: number;
  panelBackground: string;
  panelDivider: string;
  /** Splitter on a column edge that can be dragged: a full-height bar with a handle block. */
  splitter: {
    barWidth: number;
    bar: string;
    handleWidth: number;
    handleHeight: number;
    handle: string;
    handleMark: string;
    /** Bar and handle colours while the pointer is on the splitter or dragging it. */
    activeBar: string;
    activeHandle: string;
  };
}

export interface MovementTheme {
  /** Manual: actual movement is a solid line in the train colour. */
  lineWidth: number;
  /** Manual: forecast is a dashed line. */
  forecastDash: number[];
  /** Legacy: 1×8 px arrival/departure tick marks in the train colour. */
  tickLength: number;
  tickWidth: number;
  pointRadius: number;
  /** Manual icon colours: red floating point, green departed, square terminating. */
  floatingPoint: string;
  departedPoint: string;
  destinationSquare: string;
  squareSize: number;
  /** Manual: detention in red, gain in green. */
  detention: string;
  gain: string;
  gainLossFontSize: number;
  /** Legacy speed colours by direction. */
  speedUp: string;
  speedDown: string;
  speedFontSize: number;
  labelFontFamily: string;
  labelBackground: string;
  labelBorderWidth: number;
  arrowSize: number;
  /** Opacity of a blinking label in its "off" phase. */
  blinkOffOpacity: number;
  /** GPS Loco checkbox: glow behind GPS-enabled trains. */
  gpsGlow: string;
  gpsGlowWidth: number;
  /** Manual legend: TSL movement is a purple dotted line. */
  tsl: string;
  tslDash: number[];
  tslWidth: number;
}

export interface OverlayTheme {
  /**
   * Manual: block colour by department — dark red Engg open line, dark green signal, black track
   * (traction) distribution, dark blue integration, dark pink Engg const. Keys are department
   * codes upper-cased with spaces, dots and hyphens removed.
   */
  blockDepartments: Record<string, string>;
  /** Departments the manual gives no colour for. */
  blockDefault: string;
  blockFillOpacity: number;
  /**
   * Hatching by the line the block is imposed on: UP lines rise to the right, DN lines fall,
   * both lines are cross-hatched. Distance between hatch lines in pixels, and their look.
   */
  blockHatchSpacing: number;
  blockHatchWidth: number;
  blockHatchOpacity: number;
  /** Manual: the red part of the block is the burst period. */
  blockBurst: string;
  blockBurstOpacity: number;
  /** Manual: dark red line = actual start (AST); cyan line = actual end (AET). */
  blockAst: string;
  blockAet: string;
  blockEdgeWidth: number;
  /** Manual: block reason in black text. */
  blockReason: string;
  blockReasonSize: number;
  /** A station block covers this many pixels above and below the station line. */
  stationBlockHalfHeight: number;
  /** Manual icons: star = both directions / single line, triangles = UP / DN line. */
  cautionBoth: string;
  cautionUp: string;
  cautionDown: string;
  cautionIconSize: number;
  cautionTextSize: number;
  cautionText: string;
  /** Manual: Signal red, Engineering pink, Electrical green, Tele blue, ACF brown. */
  unusual: Record<string, string>;
  unusualDefault: string;
  unusualIconSize: number;
  /** Manual: line occupancy red = occupied, green = free, light blue = nominated. */
  occupied: string;
  free: string;
  nominated: string;
  occupancyBoxWidth: number;
  occupancyBoxHeight: number;
  occupancyText: string;
  occupancyTextSize: number;
  remarkMarker: string;
  remarkMarkerText: string;
  /** Manual: user (chart) remarks in red at the bottom of the chart. */
  chartRemark: string;
  chartRemarkSize: number;
  /** EPEN "MSG" label. */
  messageMarker: string;
}

const layout: ChartLayout = {
  top: 24,
  bottom: 24,
  left: 60,
  stationColumn: 86,
  cautionColumn: 90,
  unusualColumn: 32,
  occupancyColumn: 190,
  panelBackground: '#f3f3f3',
  panelDivider: '#c8c8c8',
  splitter: {
    barWidth: 4,
    bar: '#d3d9e0',
    handleWidth: 6,
    handleHeight: 46,
    handle: '#7d8894',
    handleMark: '#ffffff',
    activeBar: '#a9c8f3',
    activeHandle: '#1a73e8',
  },
};

export function marginsFor(l: ChartLayout): ChartTheme['margins'] {
  return {
    top: l.top,
    bottom: l.bottom,
    left: l.left,
    right: l.stationColumn + l.cautionColumn + l.unusualColumn + l.occupancyColumn,
  };
}

/**
 * The theme with the caution and line-occupancy columns at the given widths (0 hides one).
 * The plot takes up whatever space the columns give back.
 */
export function withColumnWidths(
  theme: ChartTheme,
  widths: { caution: number; occupancy: number },
): ChartTheme {
  const next = { ...theme.layout, cautionColumn: widths.caution, occupancyColumn: widths.occupancy };
  return { ...theme, layout: next, margins: marginsFor(next) };
}

export const DEFAULT_CHART_THEME: ChartTheme = {
  layout,
  margins: marginsFor(layout),
  tickSpacing: { minLinePx: 5, minLabelPx: 26 },
  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
  plotBackground: '#ffffff',
  axisBackground: '#fafafa',
  pastShading: '#ebe7f3',
  timeAxis: {
    hourLabel: '#d00000',
    minuteLabel: '#000000',
    hourLabelSize: 13,
    minuteLabelSize: 10,
    hourLine: '#7a7a7a',
    hourLineWidth: 1,
    minuteLine: '#d4d4d4',
    minuteLineWidth: 1,
  },
  stationAxis: {
    label: '#000000',
    boundaryLabel: '#0033cc',
    sidingLabel: '#d00000',
    labelSize: 11,
    boundaryLabelSize: 12,
    kmLabel: '#444444',
    kmLabelSize: 10,
    line: '#9a9a9a',
    lineWidth: 1,
    lineDash: [1, 4],
  },
  movement: {
    lineWidth: 1.5,
    forecastDash: [6, 4],
    tickLength: 8,
    tickWidth: 1,
    pointRadius: 3,
    floatingPoint: '#9b0000',
    departedPoint: '#00c800',
    destinationSquare: '#9b0000',
    squareSize: 7,
    detention: '#e00000',
    gain: '#008a00',
    gainLossFontSize: 10,
    speedUp: '#e07000',
    speedDown: '#8b4513',
    speedFontSize: 9,
    labelFontFamily: 'Consolas, "Courier New", monospace',
    labelBackground: 'rgba(255,255,255,0.85)',
    labelBorderWidth: 0.75,
    arrowSize: 7,
    blinkOffOpacity: 0.12,
    gpsGlow: '#ffc400',
    gpsGlowWidth: 7,
    tsl: '#8a2be2',
    tslDash: [2, 3],
    tslWidth: 2.5,
  },
  overlays: {
    blockDepartments: {
      ENGGOPENLINE: '#8b0000',
      SIGNAL: '#006400',
      TRACTIONDISTR: '#000000',
      TRACKDISTRIBUTION: '#000000',
      INTEGRATION: '#00008b',
      ENGGCONST: '#c71585',
    },
    blockDefault: '#696969',
    blockFillOpacity: 0.14,
    blockHatchSpacing: 7,
    blockHatchWidth: 1,
    blockHatchOpacity: 0.6,
    blockBurst: '#ff0000',
    blockBurstOpacity: 0.4,
    blockAst: '#8b0000',
    blockAet: '#00b7c3',
    blockEdgeWidth: 2,
    blockReason: '#000000',
    blockReasonSize: 10,
    stationBlockHalfHeight: 5,
    cautionBoth: '#2e9e2e',
    cautionUp: '#1f3fd1',
    cautionDown: '#2e9e2e',
    cautionIconSize: 11,
    cautionTextSize: 8,
    cautionText: '#000000',
    unusual: {
      SIGG: '#ff0000',
      ENGG: '#ff00ff',
      ELEC: '#2e8b57',
      TELE: '#0000ff',
      ACF: '#a52a2a',
    },
    unusualDefault: '#555555',
    unusualIconSize: 9,
    occupied: '#e02020',
    free: '#2ea043',
    nominated: '#5ec8f2',
    occupancyBoxWidth: 19,
    occupancyBoxHeight: 11,
    occupancyText: '#ffffff',
    occupancyTextSize: 8,
    remarkMarker: '#d00000',
    remarkMarkerText: '#ffffff',
    chartRemark: '#d00000',
    chartRemarkSize: 11,
    messageMarker: '#c2185b',
  },
  interaction: {
    hoverWidth: 5,
    hoverOpacity: 0.3,
    selectedWidth: 6,
    selectedOpacity: 0.45,
    overlayOutline: '#1a73e8',
  },
};

/** Normalised key for department code lookups: "ENGG-OPEN LINE" → "ENGGOPENLINE". */
export function departmentKey(code: string): string {
  return code.toUpperCase().replace(/[\s.\-_/]/g, '');
}
