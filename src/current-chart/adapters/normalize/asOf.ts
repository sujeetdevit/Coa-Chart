import { MS_PER_HOUR, type AdapterDiagnostic, type EpochMs, type Train } from '../../domain';

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
