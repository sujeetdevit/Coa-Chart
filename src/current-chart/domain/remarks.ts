import type { EpochMs } from './time';

/** Remark entered against a train (movement pad / remark form). */
export interface TrainRemark {
  trainId: string;
  trainName: string;
  /** Station code or block section ("A-B") the remark is placed against. */
  locationCode: string;
  remark: string;
  userId: string;
  at: EpochMs;
  event?: string;
}

/** General remark shown in red at the bottom of the chart (manual §3.3). No data supplied yet. */
export interface ChartRemark {
  from: EpochMs;
  to: EpochMs;
  text: string;
  userId: string;
}
