import type { Block } from './block';
import type { Board } from './board';
import type { Caution } from './caution';
import type { AdapterDiagnostic } from './diagnostics';
import type { ChartRemark, TrainRemark } from './remarks';
import type { EpochMs } from './time';
import type { Train } from './train';
import type { EpenMessage, GpsLocoMovement, TslWorking, UnusualOccurrence } from './unsupplied';

export interface CurrentChartModel {
  board: Board;
  trains: Train[];
  blocks: Block[];
  cautions: Caution[];
  trainRemarks: TrainRemark[];
  chartRemarks: ChartRemark[];
  unusualOccurrences: UnusualOccurrence[];
  tsl: TslWorking[];
  gpsLocoMovements: GpsLocoMovement[];
  epenMessages: EpenMessage[];
  /** Reference "now" for this snapshot. */
  asOf: EpochMs;
  diagnostics: AdapterDiagnostic[];
}
