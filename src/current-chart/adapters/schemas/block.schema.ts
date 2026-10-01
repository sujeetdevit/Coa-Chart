import { z } from 'zod';

/**
 * One row of block.json / WCCgetblockDataonCharts.
 * CC/DD = permitted start/end, EE/FF = actual start/end (confirmed by the user, 2026-10-01).
 */
export const blockRowSchema = z.object({
  CAVBLCKRSTNID: z.string(),
  CANSCTNNUMB: z.number(),
  CAVSTTN: z.string(),
  FROMSTTN: z.string(),
  TOSTTN: z.string(),
  BB: z.string(),
  CAVBLCKRSTNCODE: z.string(),
  CAVBLCKRSTNRMRK: z.string(),
  CC: z.string().nullable(),
  DD: z.string().nullable(),
  EE: z.string().nullable(),
  FF: z.string().nullable(),
  CADCLEARTIME: z.string().nullable(),
  CADPRMTEXTNDENDTIME: z.string().nullable(),
  CACEXTNBRSTFLAG: z.string().nullable(),
});

export type BlockRow = z.infer<typeof blockRowSchema>;
