import { IST_OFFSET_MS, MS_PER_HOUR, type EpenMessage, type EpochMs, type TimeRange } from '../domain';
import type { ChartDisplayOptions } from './displayOptions';
import { formatIstDateTime } from './trainDescriptions';

/**
 * Manual §12 Print Chart: shift start time, shift hours, Speed and Gain/Loss options, a preview,
 * the controller's name at the bottom, and EPEN messages on the printed chart. Crew is the
 * manual's print-chart crew preference.
 */
export interface PrintOptions {
  /** Start of the printed period. */
  start: EpochMs;
  /** Length of the printed period, in hours. */
  hours: number;
  showSpeed: boolean;
  showGainLoss: boolean;
  showCrew: boolean;
  /** Mark EPEN notes on the chart and print the notes below it. */
  showMessages: boolean;
  /** Printed at the bottom. Typed by the user: no source for the controller's name was supplied. */
  controllerName: string;
}

export const PRINT_HOURS = { min: 1, max: 24 } as const;

/**
 * Stage size of the printed chart in CSS pixels. Its shape fits A4 landscape under a title line;
 * the image is rendered at twice this resolution so text stays sharp on paper.
 */
export const PRINT_STAGE = { width: 1560, height: 1000, pixelRatio: 2 } as const;

/**
 * Starting point for the print form: the period and options currently on screen. The manual
 * does not say what the form starts with; "what I see is what I print" is an assumption.
 */
export function defaultPrintOptions(visible: TimeRange, shown: ChartDisplayOptions): PrintOptions {
  const hours = Math.round(((visible.end - visible.start) / MS_PER_HOUR) * 4) / 4;
  return {
    start: visible.start,
    hours: Math.min(PRINT_HOURS.max, Math.max(PRINT_HOURS.min, hours)),
    showSpeed: shown.showSpeed,
    showGainLoss: shown.showGainLoss,
    showCrew: shown.showCrew,
    showMessages: true,
    controllerName: '',
  };
}

export function printRange(options: Pick<PrintOptions, 'start' | 'hours'>): TimeRange {
  return { start: options.start, end: options.start + options.hours * MS_PER_HOUR };
}

/** The chart's display options with the print form's choices applied. */
export function printDisplayOptions(shown: ChartDisplayOptions, options: PrintOptions): ChartDisplayOptions {
  return {
    ...shown,
    showSpeed: options.showSpeed,
    showGainLoss: options.showGainLoss,
    showCrew: options.showCrew,
  };
}

/** EPEN notes written against a time inside the printed period, oldest first. */
export function messagesToPrint(messages: readonly EpenMessage[], options: PrintOptions): EpenMessage[] {
  if (!options.showMessages) return [];
  const { start, end } = printRange(options);
  return messages.filter((m) => m.at >= start && m.at <= end).sort((a, b) => a.at - b.at);
}

/** "Board 3 · 20-09-2026 22:20 to 21-09-2026 01:20 IST". */
export function printTitle(boardId: number | undefined, options: PrintOptions): string {
  const { start, end } = printRange(options);
  return `Board ${boardId ?? '—'} · ${formatIstDateTime(start)} to ${formatIstDateTime(end)} IST`;
}

/** Suggested file name for a saved image: "current-chart-board-3-20260920-2220.png". */
export function printFileName(boardId: number | undefined, options: PrintOptions): string {
  return `current-chart-board-${boardId ?? 'x'}-${toIstInputValue(options.start).replace(/[-:]/g, '').replace('T', '-')}.png`;
}

/** Epoch time → value of an `<input type="datetime-local">` showing IST wall-clock time. */
export function toIstInputValue(ms: EpochMs): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** The reverse of toIstInputValue; undefined for an empty or malformed value. */
export function fromIstInputValue(value: string): EpochMs | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
  const ms = Date.parse(`${value.slice(0, 16)}:00Z`);
  return Number.isNaN(ms) ? undefined : ms - IST_OFFSET_MS;
}
