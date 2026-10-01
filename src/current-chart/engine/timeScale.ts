import { MS_PER_MINUTE, type EpochMs } from '../domain';

/** Linear time ↔ x mapping in plot coordinates: x = 0 at `start`. */
export interface TimeScale {
  readonly start: EpochMs;
  readonly pxPerMinute: number;
}

export function timeToX(scale: TimeScale, time: EpochMs): number {
  return ((time - scale.start) / MS_PER_MINUTE) * scale.pxPerMinute;
}

export function xToTime(scale: TimeScale, x: number): EpochMs {
  return scale.start + (x / scale.pxPerMinute) * MS_PER_MINUTE;
}

/** Rescales by `factor` while keeping the time under plot x = `anchorX` fixed. */
export function zoomTimeScale(scale: TimeScale, factor: number, anchorX: number): TimeScale {
  const anchorTime = xToTime(scale, anchorX);
  const pxPerMinute = scale.pxPerMinute * factor;
  return { pxPerMinute, start: anchorTime - (anchorX / pxPerMinute) * MS_PER_MINUTE };
}

export function panTimeScale(scale: TimeScale, dx: number): TimeScale {
  return { ...scale, start: scale.start - (dx / scale.pxPerMinute) * MS_PER_MINUTE };
}
