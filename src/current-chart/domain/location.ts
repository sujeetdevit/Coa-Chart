/** A place on the board: either a single station or the block section between two stations. */
export type ChartLocation =
  | { kind: 'station'; sectionId: number; stationCode: string }
  | { kind: 'blockSection'; sectionId: number; fromStationCode: string; toStationCode: string };

export type LineDirection = 'UP' | 'DN' | 'BOTH';
