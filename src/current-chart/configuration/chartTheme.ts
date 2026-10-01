/**
 * Visual constants for the Current Chart. Colours stated by the manual are marked; the rest are
 * presentation choices. Renderers and the render-model builder read from here, never hard-code.
 */
export interface ChartTheme {
  /** Space around the plot for time labels (top/bottom) and station names (left/right, km on the right). */
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
  interaction: {
    hoverWidth: number;
    hoverOpacity: number;
    selectedWidth: number;
    selectedOpacity: number;
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
}

export const DEFAULT_CHART_THEME: ChartTheme = {
  margins: { top: 24, right: 112, bottom: 24, left: 60 },
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
  },
  interaction: {
    hoverWidth: 5,
    hoverOpacity: 0.3,
    selectedWidth: 6,
    selectedOpacity: 0.45,
  },
};
