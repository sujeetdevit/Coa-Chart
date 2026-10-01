import { z } from 'zod';

/** One row of StationLine.json / WCCGetSttnLineDetails: a running line at a station. */
export const stationLineRowSchema = z.object({
  SubSectionId: z.number(),
  MAVSTTNCODE: z.string(),
  MANSTTNSQNC: z.number(),
  MANDSPLSQNC: z.number(),
  lineno: z.number(),
  LINENAME: z.union([z.number(), z.string()]),
  LINETYPE: z.string(),
  LINEAD: z.number(),
  SidingFlag: z.string(),
  StaClass: z.string(),
  StationDistance: z.number(),
  CummDistance: z.number(),
  ActualDistance: z.number(),
});

export type StationLineRow = z.infer<typeof stationLineRowSchema>;
