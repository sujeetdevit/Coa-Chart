import { z } from 'zod';

/** One row of remark.json / WCCGetRemrks: a train remark placed against a station or block section. */
export const remarkRowSchema = z.object({
  CAVTRAINID: z.string(),
  TrainName: z.string(),
  CAVNEWTRAINNAME: z.string(),
  CANSTTNSQNCNO: z.number().nullable(),
  EVENT: z.string().nullable(),
  CAVREMARK: z.string(),
  CAVUSERID: z.string(),
  CADEVENTRPTGTIME: z.string(),
  CAVDVSNCODE: z.string(),
  BoardID: z.number(),
});

export type RemarkRow = z.infer<typeof remarkRowSchema>;
