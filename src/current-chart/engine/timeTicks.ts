import { IST_OFFSET_MS, MS_PER_MINUTE, istClock, type EpochMs, type TimeRange } from '../domain';

export interface TimeTick {
  time: EpochMs;
  /** Falls on a whole IST hour. */
  isHour: boolean;
  /** Text for the axis: the IST hour for hour ticks, the minutes otherwise. */
  label: string;
  /** Whether this tick gets a label (labels thin out before lines do). */
  labelled: boolean;
}

/** Steps the grid may use, in minutes. The manual's interval is 10; larger steps apply only when zoomed out. */
const STEPS = [10, 20, 30, 60, 120, 180, 360, 720];

export interface TickSpacing {
  /** Minimum horizontal distance between grid lines. */
  minLinePx: number;
  /** Minimum horizontal distance between labels. */
  minLabelPx: number;
}

function stepFor(pxPerMinute: number, minPx: number, base: number): number {
  return STEPS.find((s) => s >= base && s * pxPerMinute >= minPx) ?? STEPS[STEPS.length - 1] ?? 60;
}

/**
 * Grid ticks across `range`, aligned to IST wall-clock multiples of the step. At normal zoom this
 * is every 10 minutes with every tick labelled; when zoomed out, lines and labels thin out
 * independently so they never crowd.
 */
export function timeTicks(
  range: TimeRange,
  pxPerMinute: number,
  baseMinutes: number,
  spacing: TickSpacing,
): TimeTick[] {
  const lineStep = stepFor(pxPerMinute, spacing.minLinePx, baseMinutes);
  const labelStep = stepFor(pxPerMinute, spacing.minLabelPx, lineStep);
  const lineMs = lineStep * MS_PER_MINUTE;
  const labelMs = labelStep * MS_PER_MINUTE;

  const ticks: TimeTick[] = [];
  const first = Math.ceil((range.start + IST_OFFSET_MS) / lineMs) * lineMs - IST_OFFSET_MS;
  for (let time = first; time <= range.end; time += lineMs) {
    const { hour, minute } = istClock(time);
    const isHour = minute === 0;
    ticks.push({
      time,
      isHour,
      label: isHour ? String(hour) : String(minute),
      labelled: (time + IST_OFFSET_MS) % labelMs === 0,
    });
  }
  return ticks;
}
