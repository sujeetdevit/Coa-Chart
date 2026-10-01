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
};
