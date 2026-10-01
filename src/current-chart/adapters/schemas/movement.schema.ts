import { z } from 'zod';

/** One row of movement.json / WCCGetMvmntDetails: a train's visit to one station. */
export const movementRowSchema = z.object({
  TRINID: z.string(),
  TRAINNO: z.string(),
  TRAINNAME: z.string(),
  DIRECTION: z.string(),
  PGFLAG: z.string(),
  COLORCODE: z.string(),
  SUBSCTNID: z.number(),
  SEQNO: z.number(),
  STTNCODE: z.string(),
  ISARVLACTUAL: z.string(),
  ISDEPTACTUAL: z.string(),
  DPRTARVLTIME: z.string().nullable(),
  DPRTTIME: z.string().nullable(),
  SCHARVL: z.string().nullable(),
  SCHDPRT: z.string().nullable(),
  LOSS: z.string().nullable(),
  GAIN: z.string().nullable(),
  LT: z.number(),
  LASTRPTFLG: z.string(),
  DESTNFLAG: z.string(),
  PREVSTTNBRDID: z.number().nullable(),
  NXTSTTNBRDID: z.number().nullable(),
  BLCKSCTN: z.string(),
  CANSPEED: z.number().nullable(),
  LINENO: z.number().nullable(),
  LINETYPE: z.string().nullable(),
  ArvlUserID: z.string().nullable(),
  DepartureUserId: z.string().nullable(),
  TRAINCMPLDATE: z.string().nullable(),
  TOTALALLOWANCE: z.number(),
});

export type MovementRow = z.infer<typeof movementRowSchema>;
