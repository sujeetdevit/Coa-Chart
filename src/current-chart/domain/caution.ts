import type { ChartLocation, LineDirection } from './location';
import type { EpochMs } from './time';

export interface Caution {
  location: ChartLocation;
  /** Section name as supplied, e.g. "UMB-ANDI". */
  sectionName: string;
  direction: LineDirection;
  lineNo?: string;
  passengerSpeed?: number;
  goodsSpeed?: number;
  /** Kilometre/pole location text, e.g. "107/0-106/0". */
  kmLocation: string;
  from: EpochMs;
  to?: EpochMs;
  reason: string;
  department: string;
  /** Duration in force as supplied ("days/hours"). */
  inForce: string;
}
