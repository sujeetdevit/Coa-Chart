export type StationKind = 'BLOCK' | 'SIDING' | 'OTHER';

export type StationLineType = 'MAIN' | 'LOOP' | 'SIDING' | 'UNKNOWN';

export interface StationLine {
  lineNo: number;
  name: string;
  type: StationLineType;
}

export interface Station {
  code: string;
  sectionId: number;
  /** Position within the board's display order (0-based). */
  displayIndex: number;
  kind: StationKind;
  /** Section entry/exit station (shown blue on the chart). */
  isSectionBoundary: boolean;
  /** Display distance used for vertical spacing. */
  displayDistance: number;
  /** Distance from the board's reference station, in km (right-axis label). */
  kmFromReference: number;
  actualDistance: number;
  lines: StationLine[];
}

export interface Section {
  id: number;
  displayOrder: number;
  /** Station codes in display order. */
  stationCodes: string[];
}

export interface Board {
  id?: number;
  sections: Section[];
  /** Stations in display (geographical) order across all sections. */
  stations: Station[];
}
