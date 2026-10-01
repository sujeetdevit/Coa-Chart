// Domain concepts documented by the manual for which no data has been supplied yet.
// Shapes are limited to what the manual and legacy implementation state; extend when real data arrives.
import type { ChartLocation } from './location';
import type { EpochMs } from './time';

/** Manual §11.1 colours: Signal, Engineering, Electrical, Tele, ACF. Legacy also has MISC. */
export type UnusualType = 'SIGG' | 'ENGG' | 'ELEC' | 'TELE' | 'ACF' | 'MISC' | 'OTHER';

export interface UnusualOccurrence {
  location: ChartLocation;
  type: UnusualType;
  start: EpochMs;
  end?: EpochMs;
  reason: string;
  detentionMinutes?: number;
}

/** Temporary single line working on a double line section (manual §9.7). */
export interface TslWorking {
  sectionId: number;
  fromStationCode: string;
  toStationCode: string;
  line: string;
  introducedAt: EpochMs;
  cancelledAt?: EpochMs;
  reason: string;
}

export interface GpsLocoPosition {
  stationCode: string;
  sectionId: number;
  at: EpochMs;
}

/** Movement of an unattached GPS loco (GPS Loco Mvmt). */
export interface GpsLocoMovement {
  locoNumber: string;
  positions: GpsLocoPosition[];
}

/** Mid-block-section sample for MSM. */
export interface MidSectionSample {
  at: EpochMs;
  /** Distance travelled into the block section, km. */
  distanceKm: number;
  speedKmph: number;
}

/** Controller note written with the e-pen (EPEN). */
export interface EpenMessage {
  id: string;
  /** Chart time the note was written against (where the user right-clicked). */
  at: EpochMs;
  /** Station row it was written against, when the click was on a station. */
  stationCode?: string;
  sectionId?: number;
  /** Handwriting as an image data URL (format depends on the pen integration). */
  payload: string;
  savedAt: EpochMs;
}
