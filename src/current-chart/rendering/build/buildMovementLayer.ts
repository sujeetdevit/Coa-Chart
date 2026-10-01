import type { ChartDisplayOptions } from '../../application/displayOptions';
import { trainLabelText } from '../../application/trainDescriptions';
import type { MarkerAnchor } from '../../application/trainMarkers';
import type { TrainScene, TrainSceneItem } from '../../application/trainScene';
import type { ChartConfig } from '../../configuration/chartConfig';
import type { ChartTheme } from '../../configuration/chartTheme';
import type { CurrentChartEngine, TrainPathPoint } from '../../engine';
import type { Primitive, PrimitiveGroup } from '../types';
import { layoutLabels, type LabelRequest } from './labelLayout';

/** Monospace glyph width as a fraction of font size, for estimating label boxes. */
const CHAR_WIDTH = 0.6;
const LABEL_PADDING = 2;
const LINE_HEIGHT = 1.15;

export function wrapLabel(text: string, wrapAt: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    // Allow a little overflow rather than leaving a one- or two-character tail on its own line.
    const pieces = word.length <= wrapAt + 2 ? [word] : (word.match(new RegExp(`.{1,${wrapAt}}`, 'g')) ?? []);
    for (const piece of pieces) {
      if (current === '') current = piece;
      else if (current.length + 1 + piece.length <= wrapAt) current += ` ${piece}`;
      else {
        lines.push(current);
        current = piece;
      }
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${(kept[maxLines - 1] ?? '').slice(0, wrapAt - 1)}…`;
    return kept;
  }
  return lines;
}

function pointFor(item: TrainSceneItem, anchor: MarkerAnchor | undefined): TrainPathPoint | undefined {
  if (!anchor) return undefined;
  return item.actual.points.find(
    (p) => p.eventIndex === anchor.eventIndex && (p.kind === anchor.at || p.kind === 'through'),
  );
}

/** Open arrowhead with its tip at (x, y) pointing along (dx, dy). */
function arrowHead(x: number, y: number, dx: number, dy: number, size: number): number[] {
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const back = (angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [x - size * (ux * cos - uy * sin), y - size * (ux * sin + uy * cos)];
  };
  return [...back(Math.PI / 7), x, y, ...back(-Math.PI / 7)];
}

/** Travel direction at either end of a path; falls back to the train direction (DN = down). */
function travelDirection(points: TrainPathPoint[], end: 'start' | 'end'): [number, number] {
  const [a, b] =
    end === 'start' ? [points[0], points[1]] : [points[points.length - 2], points[points.length - 1]];
  if (a && b && (a.x !== b.x || a.y !== b.y)) return [b.x - a.x, b.y - a.y];
  const p = end === 'start' ? points[0] : points[points.length - 1];
  return [1, p?.direction === 'UP' ? -1 : 1];
}

function flat(points: TrainPathPoint[], ox: number, oy: number): number[] {
  return points.flatMap((p) => [p.x + ox, p.y + oy]);
}

/**
 * Train movement for the current viewport: forecast (dashed) and actual (solid) lines in the
 * train colour, arrival/departure ticks, manual point icons, handover arrows, train labels and,
 * when enabled, gain/loss and speed figures.
 */
export function buildMovementLayer(
  scene: TrainScene,
  engine: CurrentChartEngine,
  options: ChartDisplayOptions,
  config: ChartConfig,
  theme: ChartTheme,
  /** Crew-duty blink phase: dims the floating labels of over-duty trains. */
  blinkOff = false,
): PrimitiveGroup[] {
  const { plot } = engine.getChartBounds();
  const ox = plot.x;
  const oy = plot.y;
  const m = theme.movement;
  const clip = { x: plot.x, y: plot.y, width: plot.width, height: plot.height };

  const glow: Primitive[] = [];
  const lines: Primitive[] = [];
  const points: Primitive[] = [];
  const figures: Primitive[] = [];
  const labelRequests: (LabelRequest & { item: TrainSceneItem; lines: string[]; blinks: boolean })[] = [];
  const labelFont = config.trainLabels.fontSize;
  const showCrewOnLabel = options.showCrew && config.crew.chartViewCrewDetails;

  for (const item of scene.items) {
    const { train, actual, forecast, markers } = item;
    const id = train.id;
    const colour = train.colour;

    if (options.highlightGps && item.gps && actual.points.length >= 2) {
      glow.push({
        kind: 'line',
        id: `gps:${id}`,
        points: flat(actual.points, ox, oy),
        stroke: m.gpsGlow,
        strokeWidth: m.gpsGlowWidth,
        opacity: 0.55,
        lineCap: 'round',
        lineJoin: 'round',
      });
    }

    // Forecast first so the actual line draws over the shared vertex.
    if (forecast.points.length >= 2) {
      lines.push({
        kind: 'line',
        id: `fc:${id}`,
        points: flat(forecast.points, ox, oy),
        stroke: config.forecast.coloured ? colour : config.forecast.defaultColour,
        strokeWidth: m.lineWidth,
        dash: m.forecastDash,
        opacity: config.forecast.opacity,
      });
    }
    if (actual.points.length >= 2) {
      lines.push({
        kind: 'line',
        id: `ln:${id}`,
        points: flat(actual.points, ox, oy),
        stroke: colour,
        strokeWidth: m.lineWidth,
        lineJoin: 'round',
      });
    }
    for (const i of item.tslSegments) {
      const a = actual.points[i];
      const b = actual.points[i + 1];
      if (!a || !b) continue;
      lines.push({
        kind: 'line',
        id: `tsl:${id}:${i}`,
        points: [a.x + ox, a.y + oy, b.x + ox, b.y + oy],
        stroke: m.tsl,
        strokeWidth: m.tslWidth,
        dash: m.tslDash,
      });
    }
    if (actual.points.length > 0) {
      const half = m.tickLength / 2;
      lines.push({
        kind: 'segments',
        id: `tk:${id}`,
        points: actual.points.flatMap((p) => [p.x + ox, p.y + oy - half, p.x + ox, p.y + oy + half]),
        stroke: colour,
        strokeWidth: m.tickWidth,
      });
    }

    // ── point icons ──
    const departed = pointFor(item, markers.departed);
    if (departed) {
      points.push({
        kind: 'circle',
        id: `pd:${id}`,
        x: departed.x + ox,
        y: departed.y + oy,
        radius: m.pointRadius,
        fill: m.departedPoint,
      });
    }
    const floating = pointFor(item, markers.floating);
    if (floating) {
      points.push({
        kind: 'circle',
        id: `pf:${id}`,
        x: floating.x + ox,
        y: floating.y + oy,
        radius: m.pointRadius,
        fill: m.floatingPoint,
      });
    }
    const destination = pointFor(item, markers.destination);
    if (destination) {
      const s = m.squareSize;
      points.push({
        kind: 'rect',
        id: `pq:${id}`,
        x: destination.x + ox - s / 2,
        y: destination.y + oy - s / 2,
        width: s,
        height: s,
        fill: m.destinationSquare,
      });
    }

    // ── handover arrows ──
    const first = actual.points[0];
    const last = actual.points[actual.points.length - 1];
    if (markers.handoverIn && first) {
      const [dx, dy] = travelDirection(actual.points, 'start');
      points.push({
        kind: 'line',
        id: `ai:${id}`,
        points: arrowHead(first.x + ox, first.y + oy, dx, dy, m.arrowSize),
        stroke: colour,
        strokeWidth: 1.25,
      });
    }
    if (markers.handoverOut && last) {
      const [dx, dy] = travelDirection(actual.points, 'end');
      points.push({
        kind: 'line',
        id: `ao:${id}`,
        points: arrowHead(last.x + ox, last.y + oy, dx, dy, m.arrowSize),
        stroke: colour,
        strokeWidth: 1.25,
      });
    }

    // ── figures: wrong line, gain/loss, speed ──
    actual.points.forEach((p, i) => {
      const event = train.events[p.eventIndex];
      if (!event) return;
      const x = p.x + ox;
      const y = p.y + oy;
      const side = p.direction === 'UP' ? -1 : 1;
      const leaves = p.kind === 'departure' || p.kind === 'through';
      const arrives = p.kind === 'arrival' || p.kind === 'through';

      const next = actual.points[i + 1];
      if (event.wrongLine && leaves && next) {
        figures.push({
          kind: 'text',
          id: `wl:${id}:${i}`,
          text: 'W/L',
          x: (x + next.x + ox) / 2,
          y: (y + next.y + oy) / 2,
          align: 'center',
          baseline: 'middle',
          fill: colour,
          fontSize: m.gainLossFontSize,
          fontFamily: m.labelFontFamily,
        });
      }

      if (options.showGainLoss) {
        const figure = (key: string, value: number | undefined, baseline: 'bottom' | 'top', dy: number) => {
          if (value === undefined || value === 0) return;
          figures.push({
            kind: 'text',
            id: `gl${key}:${id}:${i}`,
            text: String(Math.abs(value)),
            x: x + side * 6,
            y: y + dy,
            align: side < 0 ? 'right' : 'left',
            baseline,
            fill: value > 0 ? m.detention : m.gain,
            fontSize: m.gainLossFontSize,
            fontFamily: m.labelFontFamily,
          });
        };
        if (arrives) figure('s', event.sectionGainLoss, 'bottom', -1);
        if (leaves) figure('t', event.stationGainLoss, 'top', 1);
      }

      if (options.showSpeed && leaves && event.speedKmph !== undefined) {
        figures.push({
          kind: 'text',
          id: `sp:${id}:${i}`,
          text: String(event.speedKmph),
          x: x - side * 4,
          y: y - 3,
          align: side < 0 ? 'left' : 'right',
          baseline: 'bottom',
          fill: p.direction === 'UP' ? m.speedUp : m.speedDown,
          fontSize: m.speedFontSize,
          fontFamily: m.labelFontFamily,
        });
      }
    });

    // ── label requests ──
    const text = [
      ...wrapLabel(trainLabelText(train), config.trainLabels.wrapAt, config.trainLabels.maxLines),
      ...(showCrewOnLabel ? item.crewLines : []),
    ];
    const width = Math.max(...text.map((l) => l.length)) * labelFont * CHAR_WIDTH + 2 * LABEL_PADDING;
    const height = text.length * labelFont * LINE_HEIGHT + 2 * LABEL_PADDING;
    const startPoint = first ?? forecast.points[0];
    const label = { width, height, item, lines: text };
    if (startPoint) {
      labelRequests.push({
        ...label,
        id: `${id}:start`,
        anchorX: startPoint.x,
        anchorY: startPoint.y,
        blinks: false,
      });
    }
    // The floating (end) label: shown by preference, and always for crew over duty so its blink
    // warning (manual §11.1) can't be switched off with the label.
    if ((options.showLastTrainLabel || item.crewOverDuty) && last && actual.points.length >= 2) {
      labelRequests.push({
        ...label,
        id: `${id}:end`,
        anchorX: last.x,
        anchorY: last.y,
        blinks: item.crewOverDuty,
      });
    }
  }

  // ── labels, de-cluttered across all trains ──
  const labels: Primitive[] = [];
  const byId = new Map(labelRequests.map((r) => [r.id, r]));
  for (const placed of layoutLabels(labelRequests)) {
    const request = byId.get(placed.id);
    if (!request) continue;
    const colour = request.item.train.colour;
    const opacity = request.blinks && blinkOff ? m.blinkOffOpacity : 1;
    if (placed.displaced) {
      labels.push({
        kind: 'line',
        id: `lk:${placed.id}`,
        points: [
          placed.anchorX + ox,
          placed.anchorY + oy,
          placed.x + ox,
          placed.y + oy + (placed.y < placed.anchorY ? placed.height : 0),
        ],
        stroke: colour,
        strokeWidth: 0.5,
      });
    }
    labels.push(
      {
        kind: 'rect',
        id: `lb:${placed.id}`,
        x: placed.x + ox,
        y: placed.y + oy,
        width: placed.width,
        height: placed.height,
        fill: m.labelBackground,
        stroke: colour,
        strokeWidth: request.blinks ? m.labelBorderWidth * 2 : m.labelBorderWidth,
        opacity,
      },
      {
        kind: 'text',
        id: `lt:${placed.id}`,
        text: request.lines.join('\n'),
        x: placed.x + ox + LABEL_PADDING,
        y: placed.y + oy + LABEL_PADDING,
        align: 'left',
        baseline: 'top',
        fill: colour,
        fontSize: labelFont,
        fontFamily: m.labelFontFamily,
        lineHeight: LINE_HEIGHT,
        opacity,
      },
    );
  }

  return [
    { id: 'train-gps', clip, items: glow },
    { id: 'train-lines', clip, items: lines },
    { id: 'train-points', clip, items: points },
    { id: 'train-figures', clip, items: figures },
    { id: 'train-labels', clip, items: labels },
  ];
}
