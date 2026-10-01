import type { EpochMs } from './time';

export interface LocoAssignment {
  locoNumber: string;
  /** true = attached ('A'), false = detached ('D'). */
  attached: boolean;
  /** Position within a multi-loco consist (1 = leading). */
  position: number;
  reportedAt: EpochMs;
}
