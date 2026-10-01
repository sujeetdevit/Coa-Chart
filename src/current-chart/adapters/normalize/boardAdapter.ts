import {
  stationId,
  type AdapterDiagnostic,
  type Board,
  type Section,
  type Station,
  type StationKind,
  type StationLine,
  type StationLineType,
} from '../../domain';
import type { BoardDetailsRow, StationLineRow } from '../schemas';

const SOURCE = 'boardDetails';

function stationKind(classFlag: string): StationKind {
  if (classFlag === 'B') return 'BLOCK';
  if (classFlag === 'S') return 'SIDING';
  return 'OTHER';
}

function lineType(row: StationLineRow): StationLineType {
  if (row.SidingFlag === 'S' || row.LINETYPE === 'Y') return 'SIDING';
  if (row.LINETYPE === 'MAIN LINE') return 'MAIN';
  if (row.LINETYPE === 'LOOP LINE') return 'LOOP';
  return 'UNKNOWN';
}

function linesByStation(rows: StationLineRow[]): Map<string, StationLine[]> {
  const map = new Map<string, StationLine[]>();
  for (const row of rows) {
    const key = stationId(row.SubSectionId, row.MAVSTTNCODE);
    const lines = map.get(key) ?? [];
    lines.push({ lineNo: row.lineno, name: String(row.LINENAME), type: lineType(row) });
    map.set(key, lines);
  }
  for (const lines of map.values()) lines.sort((a, b) => a.lineNo - b.lineNo);
  return map;
}

/**
 * Builds the board's station order and sections.
 *
 * Order: section display sequence, then station sequence. Section entry/exit stations are the
 * first and last non-siding stations of each section (manual: shown blue; sidings are shown red).
 */
export function adaptBoard(
  boardRows: BoardDetailsRow[],
  lineRows: StationLineRow[],
  diagnostics: AdapterDiagnostic[],
): Board {
  const ordered = [...boardRows].sort(
    (a, b) => a.MANDSPLSQNC - b.MANDSPLSQNC || a.MANSTTNSQNC - b.MANSTTNSQNC,
  );
  const lines = linesByStation(lineRows);

  const stations: Station[] = [];
  const seen = new Set<string>();
  for (const row of ordered) {
    const id = stationId(row.MANDSPLNUMB, row.MAVSTTNCODE);
    if (seen.has(id)) {
      diagnostics.push({ source: SOURCE, severity: 'warning', message: `Duplicate station ${id} skipped` });
      continue;
    }
    seen.add(id);
    stations.push({
      id,
      code: row.MAVSTTNCODE,
      sectionId: row.MANDSPLNUMB,
      displayIndex: stations.length,
      kind: stationKind(row.MACCLASSFLAG),
      isSectionBoundary: false,
      displayDistance: row.MANDSPLDIST,
      kmFromReference: row.MANDISTFROMREFSTTN,
      actualDistance: row.MANACTLDIST,
      lines: lines.get(id) ?? [],
    });
  }

  const sections: Section[] = [];
  for (const station of stations) {
    let section = sections.find((s) => s.id === station.sectionId);
    if (!section) {
      section = { id: station.sectionId, displayOrder: sections.length, stationCodes: [] };
      sections.push(section);
    }
    section.stationCodes.push(station.code);
  }

  for (const section of sections) {
    const running = stations.filter((s) => s.sectionId === section.id && s.kind !== 'SIDING');
    const first = running[0];
    const last = running[running.length - 1];
    if (first) first.isSectionBoundary = true;
    if (last) last.isSectionBoundary = true;
    reportKmAnomalies(running, diagnostics);
  }

  return { sections, stations };
}

/**
 * Flags reference distances (right-axis km labels) that don't fit the section's geographic order:
 * stations outside the longest monotonic run in the section's overall direction.
 */
function reportKmAnomalies(stations: Station[], diagnostics: AdapterDiagnostic[]): void {
  const km = stations.map((s) => s.kmFromReference);
  const first = km[0];
  const last = km[km.length - 1];
  if (first === undefined || last === undefined || km.length < 3) return;
  const fits = first >= last ? (a: number, b: number) => a >= b : (a: number, b: number) => a <= b;

  // O(n²) longest monotonic subsequence; sections have tens of stations.
  const length = km.map(() => 1);
  const prev = km.map(() => -1);
  km.forEach((value, i) => {
    for (let j = 0; j < i; j++) {
      const lj = length[j] ?? 0;
      if (fits(km[j] ?? value, value) && lj + 1 > (length[i] ?? 0)) {
        length[i] = lj + 1;
        prev[i] = j;
      }
    }
  });

  let end = 0;
  length.forEach((l, i) => {
    if (l > (length[end] ?? 0)) end = i;
  });
  const inRun = new Set<number>();
  for (let i = end; i !== -1; i = prev[i] ?? -1) inRun.add(i);

  stations.forEach((station, i) => {
    if (!inRun.has(i)) {
      diagnostics.push({
        source: SOURCE,
        severity: 'warning',
        message: `Station ${station.id} reference distance ${station.kmFromReference} km is out of geographic order`,
      });
    }
  });
}
