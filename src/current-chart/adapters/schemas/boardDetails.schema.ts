import { z } from 'zod';

/** One row of BoardDetails.json / WCCGetBoardDetails: a station in board display order. */
export const boardDetailsRowSchema = z.object({
  MANDSPLNUMB: z.number(),
  MANDSPLSQNC: z.number(),
  MANSTTNSQNC: z.number(),
  MAVSTTNCODE: z.string(),
  MANDISTFROMREFSTTN: z.number(),
  MANACTLDIST: z.number(),
  MANDSPLDIST: z.number(),
  MACCLASSFLAG: z.string(),
});

export type BoardDetailsRow = z.infer<typeof boardDetailsRowSchema>;
