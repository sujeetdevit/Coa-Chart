import type { ChartTheme } from '../../configuration/chartTheme';
import type { Station } from '../../domain';
import type { CurrentChartEngine } from '../../engine';
import type { ChartRenderModel, LinePrimitive, Primitive, PrimitiveGroup, TextPrimitive } from '../types';

/** Gap between the plot edge and axis labels. */
const LABEL_GAP = 6;

function stationLabelStyle(
  station: Station,
  theme: ChartTheme,
): Pick<TextPrimitive, 'fill' | 'fontSize' | 'bold'> {
  const axis = theme.stationAxis;
  // Siding colour wins over boundary: a siding is never a section entry/exit in practice, and the
  // manual states sidings are red.
  if (station.kind === 'SIDING') return { fill: axis.sidingLabel, fontSize: axis.labelSize, bold: false };
  if (station.isSectionBoundary)
    return { fill: axis.boundaryLabel, fontSize: axis.boundaryLabelSize, bold: true };
  return { fill: axis.label, fontSize: axis.labelSize, bold: false };
}

/**
 * Base chart: plot background, shading up to "now", 10-minute time grid with hour/minute labels
 * top and bottom, station lines, and station names on both sides with km on the right.
 */
export function buildBaseRenderModel(engine: CurrentChartEngine, theme: ChartTheme): ChartRenderModel {
  const { stage, plot } = engine.getChartBounds();
  const right = plot.x + plot.width;
  const bottom = plot.y + plot.height;
  const plotClip = { x: plot.x, y: plot.y, width: plot.width, height: plot.height };

  // ── background layer: plot, past shading, grid ──────────────────────
  const background: Primitive[] = [{ kind: 'rect', id: 'plot-bg', ...plotClip, fill: theme.plotBackground }];

  const now = engine.getCurrentTimePosition();
  const shadeWidth = Math.min(Math.max(now.x, 0), plot.width);
  if (shadeWidth > 0) {
    background.push({
      kind: 'rect',
      id: 'past-shading',
      x: plot.x,
      y: plot.y,
      width: shadeWidth,
      height: plot.height,
      fill: theme.pastShading,
    });
  }

  const ticks = engine.getTimeTicks(theme.tickSpacing);
  const { timeAxis, stationAxis, fontFamily } = theme;
  for (const tick of ticks) {
    const x = plot.x + tick.x;
    background.push({
      kind: 'line',
      id: `grid-t:${tick.time}`,
      points: [x, plot.y, x, bottom],
      stroke: tick.isHour ? timeAxis.hourLine : timeAxis.minuteLine,
      strokeWidth: tick.isHour ? timeAxis.hourLineWidth : timeAxis.minuteLineWidth,
    });
  }

  const stations = engine.getVisibleStations(stationAxis.boundaryLabelSize);
  for (const { station, y } of stations) {
    const sy = plot.y + y;
    background.push({
      kind: 'line',
      id: `grid-s:${station.id}`,
      points: [plot.x, sy, right, sy],
      stroke: stationAxis.line,
      strokeWidth: stationAxis.lineWidth,
      dash: stationAxis.lineDash,
    } satisfies LinePrimitive);
  }

  // ── axes layer: time labels and station labels ───────────────────────
  const timeLabels: Primitive[] = [];
  for (const tick of ticks) {
    if (!tick.labelled) continue;
    const x = plot.x + tick.x;
    const style = tick.isHour
      ? { fill: timeAxis.hourLabel, fontSize: timeAxis.hourLabelSize, bold: true }
      : { fill: timeAxis.minuteLabel, fontSize: timeAxis.minuteLabelSize, bold: false };
    const base = { kind: 'text', text: tick.label, x, align: 'center', fontFamily, ...style } as const;
    timeLabels.push(
      { ...base, id: `tl-top:${tick.time}`, y: plot.y - 3, baseline: 'bottom' },
      { ...base, id: `tl-bottom:${tick.time}`, y: bottom + 3, baseline: 'top' },
    );
  }

  const stationLabels: Primitive[] = [];
  for (const { station, y } of stations) {
    const sy = plot.y + y;
    const style = stationLabelStyle(station, theme);
    const base = {
      kind: 'text',
      text: station.code,
      y: sy,
      baseline: 'middle',
      fontFamily,
      ...style,
    } as const;
    stationLabels.push(
      { ...base, id: `sl-left:${station.id}`, x: plot.x - LABEL_GAP, align: 'right' },
      { ...base, id: `sl-right:${station.id}`, x: right + LABEL_GAP, align: 'left' },
      {
        kind: 'text',
        id: `sl-km:${station.id}`,
        text: formatKm(station.kmFromReference),
        x: stage.width - LABEL_GAP,
        y: sy,
        align: 'right',
        baseline: 'middle',
        fill: stationAxis.kmLabel,
        fontSize: stationAxis.kmLabelSize,
        fontFamily,
      },
    );
  }

  const groups = (id: string, items: Primitive[], clip?: PrimitiveGroup['clip']): PrimitiveGroup =>
    clip ? { id, items, clip } : { id, items };

  return {
    width: stage.width,
    height: stage.height,
    layers: {
      background: [groups('plot', background, plotClip)],
      axes: [
        // Time labels may overhang the plot edges by half a label, not into the station columns.
        groups('time-labels', timeLabels, {
          x: plot.x - 16,
          y: 0,
          width: plot.width + 32,
          height: stage.height,
        }),
        // Station labels stay within the plot's vertical extent (plus half a label).
        groups('station-labels', stationLabels, {
          x: 0,
          y: plot.y - stationAxis.boundaryLabelSize,
          width: stage.width,
          height: plot.height + 2 * stationAxis.boundaryLabelSize,
        }),
      ],
      movement: [],
      interaction: [],
    },
  };
}

function formatKm(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(2);
}
