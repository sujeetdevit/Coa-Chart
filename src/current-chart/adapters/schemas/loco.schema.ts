import { z } from 'zod';

/** One row of loco.json / WCCGetLocoDetails. */
export const locoRowSchema = z.object({
  trainid: z.string(),
  loconumb: z.string(),
  atchdtchflag: z.string(),
  locoposn: z.number(),
  CADEVENTRPTGTIME: z.string(),
});

export type LocoRow = z.infer<typeof locoRowSchema>;
