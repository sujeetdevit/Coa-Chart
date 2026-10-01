import { stationId, type Board, type ChartLocation } from '../../domain';

/** Parses "STN" or "FROM-TO" into a chart location within a section. */
export function parseLocationCode(code: string, sectionId: number): ChartLocation | undefined {
  const parts = code
    .split('-')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const [from, to] = parts;
  if (parts.length === 1 && from) return { kind: 'station', sectionId, stationCode: from };
  if (parts.length === 2 && from && to) {
    return { kind: 'blockSection', sectionId, fromStationCode: from, toStationCode: to };
  }
  return undefined;
}

/** Station codes of a location that are not on the board in its section. */
export function stationsMissingFromBoard(location: ChartLocation, board: Board): string[] {
  const codes =
    location.kind === 'station' ? [location.stationCode] : [location.fromStationCode, location.toStationCode];
  const onBoard = new Set(board.stations.map((s) => s.id));
  return codes.filter((code) => !onBoard.has(stationId(location.sectionId, code)));
}

export function describeLocation(location: ChartLocation): string {
  return location.kind === 'station'
    ? location.stationCode
    : `${location.fromStationCode}-${location.toStationCode}`;
}
