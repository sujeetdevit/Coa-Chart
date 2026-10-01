import type { ChartTheme } from '../../configuration/chartTheme';
import { MS_PER_MINUTE, type EpochMs, type MidSectionSample } from '../../domain';
import type { Size } from '../../engine';
import type { ChartRenderModel, Primitive } from '../types';

export interface MsmPlot {
  model: ChartRenderModel;
  /** Inverse mapping for the speed/time tooltip. */
  xToTime: (x: number) => EpochMs;
}

const MARGIN = { top: 14, right: 12, bottom: 22, left: 40 };

/**
 * Mid-section plot for one traversed block section (manual §11.1 MSM): distance into the
 * section against time, with a minute grid. Drawn by the same renderer as the main chart.
 */
export function buildMsmRenderModel(
  samples: MidSectionSample[],
  size: Size,
  theme: ChartTheme,
  colour: string,
  istLabel: (t: EpochMs) => string,
): MsmPlot {
  const plot = {
    x: MARGIN.left,
    y: MARGIN.top,
    width: Math.max(1, size.width - MARGIN.left - MARGIN.right),
    height: Math.max(1, size.height - MARGIN.top - MARGIN.bottom),
  };
  const t0 = samples[0]?.at ?? 0;
  const t1 = samples[samples.length - 1]?.at ?? t0 + MS_PER_MINUTE;
  const maxKm = Math.max(0.1, ...samples.map((s) => s.distanceKm));
  const span = Math.max(1, t1 - t0);
  const x = (t: EpochMs) => plot.x + ((t - t0) / span) * plot.width;
  const y = (km: number) => plot.y + (km / maxKm) * plot.height;

  const items: Primitive[] = [{ kind: 'rect', id: 'bg', ...plot, fill: '#fde8ec' }];
  for (let t = Math.ceil(t0 / MS_PER_MINUTE) * MS_PER_MINUTE; t <= t1; t += MS_PER_MINUTE) {
    items.push(
      {
        kind: 'line',
        id: `g:${t}`,
        points: [x(t), plot.y, x(t), plot.y + plot.height],
        stroke: '#e6a0ae',
        strokeWidth: 1,
      },
      {
        kind: 'text',
        id: `gl:${t}`,
        text: istLabel(t),
        x: x(t),
        y: plot.y + plot.height + 3,
        align: 'center',
        baseline: 'top',
        fill: '#333333',
        fontSize: 9,
        fontFamily: theme.fontFamily,
      },
    );
  }
  for (const km of [0, maxKm / 2, maxKm]) {
    items.push({
      kind: 'text',
      id: `km:${km}`,
      text: `${km.toFixed(1)} km`,
      x: plot.x - 4,
      y: y(km),
      align: 'right',
      baseline: 'middle',
      fill: '#333333',
      fontSize: 9,
      fontFamily: theme.fontFamily,
    });
  }
  items.push({
    kind: 'line',
    id: 'curve',
    points: samples.flatMap((s) => [x(s.at), y(s.distanceKm)]),
    stroke: colour,
    strokeWidth: 2,
    lineJoin: 'round',
  });

  return {
    model: {
      width: size.width,
      height: size.height,
      layers: {
        background: [],
        infrastructure: [],
        movement: [{ id: 'msm', items }],
        axes: [],
        interaction: [],
      },
    },
    xToTime: (px) => t0 + ((px - plot.x) / plot.width) * span,
  };
}
