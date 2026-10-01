import type { Block, EpochMs } from '../domain';

/**
 * The time spans to draw for a block (manual §11.1 "Representation of Block").
 * - `start`–`end`: the block body. Actual times when the block has started, else the permitted window.
 * - burst: the part of the actual block after the permitted end (manual: "red part … burst period").
 * - ast / aet: actual start / end lines (dark red / cyan).
 */
export interface BlockPeriod {
  start: EpochMs;
  end: EpochMs;
  /** Not started yet: only the permitted window is known. */
  permittedOnly: boolean;
  /** Still in progress at `now` (no actual end or clearance yet). */
  ongoing: boolean;
  burst?: { start: EpochMs; end: EpochMs };
  ast?: EpochMs;
  aet?: EpochMs;
}

export function blockPeriod(block: Block, now: EpochMs): BlockPeriod | undefined {
  const { permitted, actual } = block;

  if (actual.start === undefined) {
    if (permitted.start === undefined || permitted.end === undefined) return undefined;
    return { start: permitted.start, end: permitted.end, permittedOnly: true, ongoing: false };
  }

  const finished = actual.end ?? block.clearedAt;
  const end = finished ?? Math.max(now, actual.start);
  const period: BlockPeriod = {
    start: actual.start,
    end,
    permittedOnly: false,
    ongoing: finished === undefined,
    ast: actual.start,
  };
  if (actual.end !== undefined) period.aet = actual.end;

  const permittedEnd = block.permittedExtendedEnd ?? permitted.end;
  if (permittedEnd !== undefined && end > permittedEnd) {
    period.burst = { start: Math.max(actual.start, permittedEnd), end };
  }
  return period;
}
