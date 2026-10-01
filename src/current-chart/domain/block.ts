import type { ChartLocation, LineDirection } from './location';
import type { EpochMs } from './time';

export interface Block {
  id: string;
  location: ChartLocation;
  direction: LineDirection;
  /** Department / reason code (e.g. ENGG-OPENLINE, SIGNAL). */
  department: string;
  reason: string;
  permitted: { start?: EpochMs; end?: EpochMs };
  actual: { start?: EpochMs; end?: EpochMs };
  clearedAt?: EpochMs;
  permittedExtendedEnd?: EpochMs;
  /** Source CACEXTNBRSTFLAG; meaning not yet confirmed. */
  extensionBurstFlag?: string;
}
