import type { ChartTheme } from '../configuration/chartTheme';
import {
  stationId,
  type Block,
  type ChartLocation,
  type ChartRemark,
  type CurrentChartModel,
  type EpenMessage,
  type EpochMs,
  type TrainRemark,
  type UnusualOccurrence,
} from '../domain';
import type { CurrentChartEngine, Rect } from '../engine';
import { blockPeriod, type BlockPeriod } from './blockPeriods';
import { activeCautionGroups, cautionSpeedText, type CautionGroup } from './cautions';
import { lineCode, lineOccupancyAt, type LineState } from './lineOccupancy';
import {
  describeBlock,
  describeCautionGroup,
  describeChartRemark,
  describeLine,
  describeTrainRemarks,
  describeUnusual,
} from './overlayDescriptions';
import { formatIstDateTime, type TooltipContent } from './trainDescriptions';

/** Something on the chart with a hover area and tooltip. Rects are in stage coordinates. */
export interface OverlayHit {
  id: string;
  rect: Rect;
  tooltip: TooltipContent;
}

export interface BlockShape {
  id: string;
  block: Block;
  period: BlockPeriod;
  /** Stage coordinates. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  burst?: { x0: number; x1: number };
  astX?: number;
  aetX?: number;
}

export interface CautionIcon {
  id: string;
  group: CautionGroup;
  cx: number;
  cy: number;
  text: string;
}

export interface UnusualIcon {
  id: string;
  occurrence: UnusualOccurrence;
  cx: number;
  cy: number;
}

export interface OccupancyBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  code: string;
  state: LineState;
}

export interface RemarkMarker {
  id: string;
  x: number;
  y: number;
  remark: TrainRemark;
}

export interface ChartRemarkText {
  id: string;
  x: number;
  y: number;
  remark: ChartRemark;
}

/** EPEN "MSG" label (manual §11.1.1). Clicking it shows the note. */
export interface MessageMarker {
  id: string;
  x: number;
  y: number;
  message: EpenMessage;
}

export interface ColumnBounds {
  caution: Rect;
  unusual: Rect;
  occupancy: Rect;
}

export interface OverlayScene {
  columns: ColumnBounds;
  blocks: BlockShape[];
  cautions: CautionIcon[];
  unusual: UnusualIcon[];
  occupancy: OccupancyBox[];
  remarks: RemarkMarker[];
  chartRemarks: ChartRemarkText[];
  messages: MessageMarker[];
  /** Small targets (icons, boxes, markers) — tested before trains. */
  topHits: OverlayHit[];
  /** Large areas (blocks) — tested after trains so trains crossing a block stay hoverable. */
  bottomHits: OverlayHit[];
}

const CAUTION_SLOT = 28;
const UNUSUAL_SLOT = 12;
const REMARK_SIZE = 11;
const CHART_REMARK_LINE = 15;
export const MSG_WIDTH = 30;
export const MSG_HEIGHT = 14;

/**
 * Places blocks, caution/unusual icons, line-occupancy boxes and remarks for the current
 * viewport. Business state (what is in force, what is occupied) comes from the application
 * rules; this only decides where things go.
 */
export function buildOverlayScene(
  engine: CurrentChartEngine,
  model: CurrentChartModel,
  theme: ChartTheme,
  now: EpochMs,
): OverlayScene {
  const { plot } = engine.getChartBounds();
  const { layout, overlays } = theme;
  const plotRight = plot.x + plot.width;
  const columns: ColumnBounds = {
    caution: {
      x: plotRight + layout.stationColumn,
      y: plot.y,
      width: layout.cautionColumn,
      height: plot.height,
    },
    unusual: {
      x: plotRight + layout.stationColumn + layout.cautionColumn,
      y: plot.y,
      width: layout.unusualColumn,
      height: plot.height,
    },
    occupancy: {
      x: plotRight + layout.stationColumn + layout.cautionColumn + layout.unusualColumn,
      y: plot.y,
      width: layout.occupancyColumn,
      height: plot.height,
    },
  };

  const yOf = (location: ChartLocation): number | undefined => {
    if (location.kind === 'station') {
      const y = engine.stationToY(stationId(location.sectionId, location.stationCode));
      return y === undefined ? undefined : y + plot.y;
    }
    const a = engine.stationToY(stationId(location.sectionId, location.fromStationCode));
    const b = engine.stationToY(stationId(location.sectionId, location.toStationCode));
    return a === undefined || b === undefined ? undefined : (a + b) / 2 + plot.y;
  };
  const inPlotY = (y: number) => y >= plot.y - 10 && y <= plot.y + plot.height + 10;
  const xOf = (t: EpochMs) => engine.timeToX(t) + plot.x;

  const topHits: OverlayHit[] = [];
  const bottomHits: OverlayHit[] = [];

  // ── blocks ──
  const blocks: BlockShape[] = [];
  model.blocks.forEach((block, i) => {
    const period = blockPeriod(block, now);
    if (!period) return;
    let y0: number | undefined;
    let y1: number | undefined;
    if (block.location.kind === 'station') {
      const y = yOf(block.location);
      if (y !== undefined)
        [y0, y1] = [y - overlays.stationBlockHalfHeight, y + overlays.stationBlockHalfHeight];
    } else {
      const a = engine.stationToY(stationId(block.location.sectionId, block.location.fromStationCode));
      const b = engine.stationToY(stationId(block.location.sectionId, block.location.toStationCode));
      if (a !== undefined && b !== undefined) [y0, y1] = [Math.min(a, b) + plot.y, Math.max(a, b) + plot.y];
    }
    if (y0 === undefined || y1 === undefined) return;
    const x0 = xOf(period.start);
    const x1 = xOf(period.end);
    if (x1 < plot.x || x0 > plotRight || y1 < plot.y || y0 > plot.y + plot.height) return;

    const shape: BlockShape = { id: `blk:${block.id}:${i}`, block, period, x0, x1, y0, y1 };
    if (period.burst) shape.burst = { x0: xOf(period.burst.start), x1: xOf(period.burst.end) };
    if (period.ast !== undefined) shape.astX = xOf(period.ast);
    if (period.aet !== undefined) shape.aetX = xOf(period.aet);
    blocks.push(shape);
    bottomHits.push({
      id: shape.id,
      rect: { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) },
      tooltip: describeBlock(block, period),
    });
  });

  // ── caution column: icons stacked side by side when they share a position ──
  const cautions: CautionIcon[] = [];
  const cautionSlots = new Map<number, number>();
  for (const group of activeCautionGroups(model.cautions, now)) {
    const y = yOf(group.location);
    if (y === undefined || !inPlotY(y)) continue;
    const row = Math.round(y);
    const slot = cautionSlots.get(row) ?? 0;
    cautionSlots.set(row, slot + 1);
    // A narrowed column shows the icons that still start inside it; a hidden one shows none.
    if (slot * CAUTION_SLOT >= columns.caution.width) continue;
    const cx = columns.caution.x + CAUTION_SLOT / 2 + slot * CAUTION_SLOT;
    const icon: CautionIcon = { id: `ctn:${group.key}`, group, cx, cy: y, text: cautionSpeedText(group) };
    cautions.push(icon);
    const half = overlays.cautionIconSize / 2;
    topHits.push({
      id: icon.id,
      rect: {
        x: cx - CAUTION_SLOT / 2,
        y: y - half - overlays.cautionTextSize - 2,
        width: CAUTION_SLOT,
        height: 2 * half + overlays.cautionTextSize + 2,
      },
      tooltip: describeCautionGroup(group),
    });
  }

  // ── unusual column ──
  const unusual: UnusualIcon[] = [];
  const unusualSlots = new Map<number, number>();
  model.unusualOccurrences.forEach((occurrence, i) => {
    if (occurrence.start > now || (occurrence.end !== undefined && occurrence.end <= now)) return;
    const y = yOf(occurrence.location);
    if (y === undefined || !inPlotY(y)) return;
    const row = Math.round(y);
    const slot = unusualSlots.get(row) ?? 0;
    unusualSlots.set(row, slot + 1);
    const icon = {
      id: `unu:${i}`,
      occurrence,
      cx: columns.unusual.x + 4 + UNUSUAL_SLOT / 2 + slot * UNUSUAL_SLOT,
      cy: y,
    };
    unusual.push(icon);
    const s = overlays.unusualIconSize;
    topHits.push({
      id: icon.id,
      rect: { x: icon.cx - s / 2 - 1, y: y - s / 2 - 1, width: s + 2, height: s + 2 },
      tooltip: describeUnusual(occurrence),
    });
  });

  // ── line occupancy column ──
  const occupancy: OccupancyBox[] = [];
  const states = lineOccupancyAt(model, now);
  const { occupancyBoxWidth: w, occupancyBoxHeight: h } = overlays;
  for (const { station, y } of engine.getVisibleStations()) {
    const lines = states.get(station.id) ?? [];
    lines.forEach((occ, i) => {
      const box: OccupancyBox = {
        id: `occ:${station.id}:${occ.line.lineNo}`,
        x: columns.occupancy.x + 6 + i * (w + 1),
        y: y + plot.y - h / 2,
        width: w,
        height: h,
        code: lineCode(occ.line),
        state: occ.state,
      };
      if (box.x + w > columns.occupancy.x + columns.occupancy.width) return;
      occupancy.push(box);
      topHits.push({
        id: box.id,
        rect: { x: box.x, y: box.y, width: w, height: h },
        tooltip: describeLine(station.code, occ),
      });
    });
  }

  // ── train remarks: marker at the remark time on its station / block section ──
  const remarks: RemarkMarker[] = [];
  const codes = new Map(model.board.stations.map((s) => [s.code, s.sectionId]));
  model.trainRemarks.forEach((remark, i) => {
    const [from, to] = remark.locationCode.split('-');
    const sectionId = from ? codes.get(from) : undefined;
    if (!from || sectionId === undefined) return;
    const location: ChartLocation = to
      ? { kind: 'blockSection', sectionId, fromStationCode: from, toStationCode: to }
      : { kind: 'station', sectionId, stationCode: from };
    const y = yOf(location);
    const x = xOf(remark.at);
    if (y === undefined || !inPlotY(y) || x < plot.x || x > plotRight) return;
    const marker = { id: `rmk:${i}`, x, y, remark };
    remarks.push(marker);
    topHits.push({
      id: marker.id,
      rect: { x: x - REMARK_SIZE / 2, y: y - REMARK_SIZE / 2, width: REMARK_SIZE, height: REMARK_SIZE },
      tooltip: describeTrainRemarks([remark]),
    });
  });

  // ── chart (user) remarks: red text along the bottom of the plot while in effect ──
  const chartRemarks: ChartRemarkText[] = [];
  const visible = engine.getVisibleTimeRange();
  model.chartRemarks
    .filter((r) => r.from <= visible.end && r.to >= visible.start)
    .forEach((remark, i) => {
      const x = Math.max(xOf(remark.from), plot.x + 4);
      const y = plot.y + plot.height - 4 - i * CHART_REMARK_LINE;
      chartRemarks.push({ id: `crm:${i}`, x, y, remark });
      topHits.push({
        id: `crm:${i}`,
        rect: {
          x,
          y: y - CHART_REMARK_LINE + 2,
          width: Math.min(400, plotRight - x),
          height: CHART_REMARK_LINE,
        },
        tooltip: describeChartRemark(remark),
      });
    });

  // ── EPEN messages: "MSG" at the time/station the note was written against ──
  const messages: MessageMarker[] = [];
  for (const message of model.epenMessages) {
    const x = xOf(message.at);
    const stationY =
      message.stationCode !== undefined && message.sectionId !== undefined
        ? yOf({ kind: 'station', sectionId: message.sectionId, stationCode: message.stationCode })
        : undefined;
    const y = stationY ?? plot.y + plot.height - 30;
    if (x < plot.x || x > plotRight || !inPlotY(y)) continue;
    const marker = { id: `msg:${message.id}`, x, y, message };
    messages.push(marker);
    topHits.push({
      id: marker.id,
      rect: { x: x - MSG_WIDTH / 2, y: y - MSG_HEIGHT / 2, width: MSG_WIDTH, height: MSG_HEIGHT },
      tooltip: {
        title: 'Message (EPEN)',
        lines: [`Written for ${formatIstDateTime(message.at)}`, 'Click to view'],
      },
    });
  }

  return {
    columns,
    blocks,
    cautions,
    unusual,
    occupancy,
    remarks,
    chartRemarks,
    messages,
    topHits,
    bottomHits,
  };
}

export function overlayAt(hits: OverlayHit[], x: number, y: number): OverlayHit | undefined {
  // Later entries draw on top, so search from the end.
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    if (!hit) continue;
    const r = hit.rect;
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return hit;
  }
  return undefined;
}
