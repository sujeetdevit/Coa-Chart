import { z } from 'zod';

/** One row of crew.json / WCCGetCrewDetails. */
export const crewRowSchema = z.object({
  TRAINID: z.string(),
  CREWNAME: z.string(),
  CREWTYPE: z.string(),
  SIGNONTIME: z.string(),
  SIGNOFFTIME: z.string().nullable(),
  COD: z.number(),
  CLINAME: z.string(),
});

export type CrewRow = z.infer<typeof crewRowSchema>;
