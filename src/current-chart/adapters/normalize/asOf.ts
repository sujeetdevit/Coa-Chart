import { MS_PER_HOUR, MS_PER_MINUTE, type AdapterDiagnostic, type EpochMs, type Train } from '../../domain';

/**
 * Reference "now" for a snapshot with no explicit time: the latest actual arrival or departure.
 * Returns undefined when there are no reported events.
 */
export function latestReportedTime(trains: Train[]): EpochMs | undefined {
  let latest: EpochMs | undefined;
  for (const train of trains) {
    for (const event of train.events) {
      for (const t of [event.arrival, event.departure]) {
        if (t !== undefined && (latest === undefined || t > latest)) latest = t;
      }
    }
  }
  return latest;
}

export interface SnapshotTimeRule {
  windowMinutes: number;
  minEvents: number;
}

function reportedTimes(trains: Train[]): EpochMs[] {
  const times: EpochMs[] = [];
  for (const train of trains) {
    for (const event of train.events) {
      if (event.arrival !== undefined) times.push(event.arrival);
      if (event.departure !== undefined) times.push(event.departure);
    }
  }
  return times.sort((a, b) => a - b);
}

/**
 * Reference "now" for a snapshot with no explicit time: the latest reported event that still has
 * at least `minEvents` reports in the `windowMinutes` before it. Isolated late reports (stragglers
 * after the extraction window) are ignored. Falls back to the latest event when reporting is sparse.
 */
export function snapshotTime(trains: Train[], rule: SnapshotTimeRule): EpochMs | undefined {
  const times = reportedTimes(trains);
  const windowMs = rule.windowMinutes * MS_PER_MINUTE;
  let lo = times.length - 1;
  for (let hi = times.length - 1; hi >= 0; hi--) {
    const t = times[hi] ?? 0;
    // `lo` only moves left as `hi` does: two-pointer count of events in (t - window, t].
    while (lo > 0 && (times[lo - 1] ?? 0) > t - windowMs) lo--;
    if (lo > hi) lo = hi;
    if (hi - lo + 1 >= rule.minEvents) return t;
  }
  return times[times.length - 1];
}

/** Count of reported events after the snapshot time (shown as future on the chart). */
export function eventsAfter(trains: Train[], asOf: EpochMs): number {
  return reportedTimes(trains).filter((t) => t > asOf).length;
}

/** Reports trains whose last reported event is far older than the snapshot time (e.g. stale data). */
export function reportStaleTrains(
  trains: Train[],
  asOf: EpochMs,
  staleEventHours: number,
  diagnostics: AdapterDiagnostic[],
): void {
  const stale = trains.filter((train) => {
    const latest = latestReportedTime([train]);
    return latest !== undefined && asOf - latest > staleEventHours * MS_PER_HOUR;
  });
  if (stale.length > 0) {
    diagnostics.push({
      source: 'movement',
      severity: 'info',
      message: `${stale.length} train(s) last reported more than ${staleEventHours} h before the snapshot time: ${stale
        .map((t) => t.id)
        .join(', ')}`,
    });
  }
}
