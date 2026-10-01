import type { EpochMs } from './time';

export interface CrewMember {
  name: string;
  /** Crew type code as supplied (e.g. DR, ADR, GD). */
  type: string;
  signOn: EpochMs;
  signOff?: EpochMs;
  /** Continuous minutes on duty as reported by the source. */
  minutesOnDuty: number;
  controllerName?: string;
}
