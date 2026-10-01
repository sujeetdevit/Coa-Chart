import { z } from 'zod';

/** One row of caution.json / WCCfetchCautionDataonChart. */
export const cautionRowSchema = z.object({
  SECTION: z.string(),
  BLOCKSECTION: z.string(),
  SUBSCTNUMB: z.number(),
  BOARDID: z.number(),
  DRTN: z.string(),
  LINENO: z.string().nullable(),
  PASSPEED: z.number().nullable(),
  GDSPEED: z.number().nullable(),
  LOCATION: z.string(),
  FROMDATETIME: z.string(),
  TODATETIME: z.string().nullable(),
  REASONDESC: z.string(),
  DEPTCODE: z.string(),
  DAYHH: z.string(),
});

export type CautionRow = z.infer<typeof cautionRowSchema>;
