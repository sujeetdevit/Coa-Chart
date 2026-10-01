import { istClock, type EpochMs, type Train, type TrainCategory } from '../domain';
import type { TrainPathPoint } from '../engine';

const CATEGORY: Record<TrainCategory, string> = { GOODS: 'Goods', PASSENGER: 'Passenger', OTHER: 'Other' };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIstTime(ms: EpochMs, withSeconds = false): string {
  const c = istClock(ms);
  const hm = `${pad(c.hour)}:${pad(c.minute)}`;
  return withSeconds ? `${hm}:${pad(c.second)}` : hm;
}

/** Label shown on the chart: the train number, or the name when there is no number. */
export function trainLabelText(train: Train): string {
  return train.number ?? train.name;
}

/** "22448 AADR-NDLS VANDE BHARAT" or just the name. */
export function trainTitle(train: Train): string {
  return train.number ? `${train.number} ${train.name}` : train.name;
}

/** Lateness at the last reported station, as the legacy tooltip phrases it. */
export function lateStatus(train: Train): string | undefined {
  const last =
    [...train.events].reverse().find((e) => e.isLastReported) ?? train.events[train.events.length - 1];
  if (!last || last.lateMinutes === undefined) return undefined;
  if (last.lateMinutes > 0) return `${last.lateMinutes} min late at ${last.stationCode}`;
  if (last.lateMinutes < 0) return `${-last.lateMinutes} min early at ${last.stationCode}`;
  return `Right time at ${last.stationCode}`;
}

export function locoLines(train: Train): string[] {
  const attached = train.locos.filter((l) => l.attached);
  const shown = attached.length > 0 ? attached : train.locos;
  return [...new Set(shown.map((l) => l.locoNumber))];
}

export function crewLines(train: Train): string[] {
  return train.crew.map((c) => {
    const signOff = c.signOff === undefined ? 'on duty' : `off ${formatIstTime(c.signOff)}`;
    return `${c.name} (${c.type}) on ${formatIstTime(c.signOn)}, ${signOff}`;
  });
}

export interface TooltipContent {
  title: string;
  lines: string[];
}

const VERTEX_VERB = { arrival: 'Arrival', departure: 'Departure', through: 'Through', forecast: 'Forecast' };

/** Tooltip for a hovered train line or point. Floating-point hover shows crew (manual §11.1). */
export function describeTrainHover(
  train: Train,
  point: TrainPathPoint | undefined,
  isFloatingPoint: boolean,
): TooltipContent {
  const lines: string[] = [CATEGORY[train.category]];
  if (point) {
    const station = point.stationId.split(':')[1] ?? point.stationId;
    lines.push(`${VERTEX_VERB[point.kind]} ${station} ${formatIstTime(point.time, true)}`);
  }
  if (train.category === 'PASSENGER') {
    const status = lateStatus(train);
    if (status) lines.push(status);
  }
  const locos = locoLines(train);
  if (locos.length > 0) lines.push(`Loco ${locos.join(', ')}`);
  if (isFloatingPoint) {
    const crew = crewLines(train);
    lines.push(...(crew.length > 0 ? crew : ['No crew details']));
  }
  return { title: trainTitle(train), lines };
}
