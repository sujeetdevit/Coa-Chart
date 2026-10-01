import type { Train } from '../domain';

/**
 * Whether a train is GPS-loco enabled. The data has no explicit flag; a train with any arrival or
 * departure reported by RTIS (GPSDATA) or REMLOT is treated as GPS-enabled — the same proxy the
 * legacy chart uses for its GPS/RTIS/REMLOT filters.
 */
export function isGpsTrain(train: Train): boolean {
  return train.events.some(
    (e) =>
      e.arrivalSource === 'RTIS' ||
      e.arrivalSource === 'REMLOT' ||
      e.departureSource === 'RTIS' ||
      e.departureSource === 'REMLOT',
  );
}
