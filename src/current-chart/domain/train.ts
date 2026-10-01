import type { CrewMember } from './crew';
import type { LocoAssignment } from './loco';
import type { EpochMs } from './time';

export type Direction = 'UP' | 'DN';

/** Source PGFLAG: G / P / O. */
export type TrainCategory = 'GOODS' | 'PASSENGER' | 'OTHER';

/** Who reported an arrival or departure. */
export type EventSource = 'MANUAL' | 'RTIS' | 'REMLOT';

/** One station visit of a train, as actually reported. */
export interface TrainEvent {
  sequence: number;
  stationCode: string;
  sectionId: number;
  direction?: Direction;
  arrival?: EpochMs;
  departure?: EpochMs;
  scheduledArrival?: EpochMs;
  scheduledDeparture?: EpochMs;
  /** Gain/loss in the block section ending at this station, minutes. Positive = time lost. */
  sectionGainLoss?: number;
  /** Gain/loss at this station, minutes. Positive = time lost (detention). */
  stationGainLoss?: number;
  lateMinutes?: number;
  speedKmph?: number;
  lineNo?: number;
  wrongLine: boolean;
  isLastReported: boolean;
  isDestination: boolean;
  prevBoardId?: number;
  nextBoardId?: number;
  nextBlockSection?: string;
  arrivalSource?: EventSource;
  departureSource?: EventSource;
}

export type ForecastKind = 'BASIC' | 'FULL' | 'SINGLE' | 'MANUAL';

export interface ForecastPoint {
  stationCode: string;
  sectionId: number;
  arrival?: EpochMs;
  departure?: EpochMs;
}

export interface TrainForecast {
  kind: ForecastKind;
  points: ForecastPoint[];
}

export interface Train {
  id: string;
  number?: string;
  name: string;
  category: TrainCategory;
  /** Line colour as supplied by the data (COLORCODE). */
  colour: string;
  events: TrainEvent[];
  forecast?: TrainForecast;
  crew: CrewMember[];
  locos: LocoAssignment[];
  completedAt?: EpochMs;
}
