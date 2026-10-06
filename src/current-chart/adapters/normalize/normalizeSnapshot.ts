import { DEFAULT_CHART_CONFIG } from '../../configuration/chartConfig';
import type { CurrentChartModel, EpochMs } from '../../domain';
import type { RawChartSnapshot } from '../types';
import { validateSnapshot } from '../validateSnapshot';
import { eventsAfter, reportStaleTrains, snapshotTime } from './asOf';
import { adaptBlocks } from './blockAdapter';
import { adaptBoard } from './boardAdapter';
import { adaptCautions } from './cautionAdapter';
import { adaptTrainRemarks } from './remarkAdapter';
import { adaptTrains } from './trainAdapter';

export interface NormalizeOptions {
  /**
   * Snapshot "now". Defaults to the end of continuous reporting in the data (see snapshotTime),
   * else the current clock.
   */
  asOf?: EpochMs;
  boardId?: number;
  staleEventHours?: number;
}

/** Validates a raw snapshot and converts it into the Current Chart domain model. */
export function normalizeSnapshot(raw: RawChartSnapshot, options: NormalizeOptions = {}): CurrentChartModel {
  const { snapshot, diagnostics } = validateSnapshot(raw);
  for (const [source, reason] of Object.entries(raw.loadErrors ?? {})) {
    diagnostics.push({
      source,
      severity: 'error',
      message: `Not loaded, so the chart is shown without it. ${reason}`,
    });
  }

  const board = adaptBoard(snapshot.boardDetails, snapshot.stationLines, diagnostics);
  // BoardDetails carries no board ID; the caution and remark rows do.
  const boardIds = new Set([
    ...snapshot.cautions.map((c) => c.BOARDID),
    ...snapshot.remarks.map((r) => r.BoardID),
  ]);
  const [inferredBoardId] = boardIds;
  if (options.boardId !== undefined) {
    board.id = options.boardId;
  } else if (boardIds.size === 1 && inferredBoardId !== undefined) {
    board.id = inferredBoardId;
  } else if (boardIds.size > 1) {
    diagnostics.push({
      source: 'boardDetails',
      severity: 'warning',
      message: `Conflicting board IDs in caution/remark data: ${[...boardIds].join(', ')}`,
    });
  }

  const trains = adaptTrains(snapshot.movement, snapshot.crew, snapshot.loco, board, diagnostics);
  const asOf = options.asOf ?? snapshotTime(trains, DEFAULT_CHART_CONFIG.snapshotTime) ?? Date.now();
  if (options.asOf === undefined) {
    const later = eventsAfter(trains, asOf);
    if (later > 0) {
      diagnostics.push({
        source: 'movement',
        severity: 'info',
        message: `Snapshot time set to the end of continuous reporting; ${later} later isolated report(s) appear ahead of "now"`,
      });
    }
  }
  reportStaleTrains(
    trains,
    asOf,
    options.staleEventHours ?? DEFAULT_CHART_CONFIG.staleEventHours,
    diagnostics,
  );

  return {
    board,
    trains,
    blocks: adaptBlocks(snapshot.blocks, board, diagnostics),
    cautions: adaptCautions(snapshot.cautions, board, diagnostics),
    trainRemarks: adaptTrainRemarks(snapshot.remarks, board, diagnostics),
    // No source data supplied yet for these.
    chartRemarks: [],
    unusualOccurrences: [],
    tsl: [],
    gpsLocoMovements: [],
    epenMessages: [],
    asOf,
    diagnostics,
  };
}
