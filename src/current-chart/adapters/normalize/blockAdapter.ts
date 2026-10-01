import type { AdapterDiagnostic, Block, Board, ChartLocation } from '../../domain';
import type { BlockRow } from '../schemas';
import { parseCoaDateTime } from '../shared/coaDateTime';
import { describeLocation, stationsMissingFromBoard } from './locationAdapter';
import { defined, emptyToUndefined, parseLineDirection } from './shared';

const SOURCE = 'blocks';

function blockLocation(row: BlockRow): ChartLocation | undefined {
  const station = emptyToUndefined(row.CAVSTTN);
  if (station) return { kind: 'station', sectionId: row.CANSCTNNUMB, stationCode: station };
  const from = emptyToUndefined(row.FROMSTTN);
  const to = emptyToUndefined(row.TOSTTN);
  if (from && to) {
    return { kind: 'blockSection', sectionId: row.CANSCTNNUMB, fromStationCode: from, toStationCode: to };
  }
  return undefined;
}

/** CC/DD = permitted start/end, EE/FF = actual start/end, CADCLEARTIME = clearance. */
export function adaptBlocks(rows: BlockRow[], board: Board, diagnostics: AdapterDiagnostic[]): Block[] {
  return rows.flatMap((row, index): Block[] => {
    const location = blockLocation(row);
    if (!location) {
      diagnostics.push({ source: SOURCE, severity: 'warning', row: index, message: 'Block has no location' });
      return [];
    }
    const missing = stationsMissingFromBoard(location, board);
    if (missing.length > 0) {
      diagnostics.push({
        source: SOURCE,
        severity: 'warning',
        row: index,
        message: `Block ${row.CAVBLCKRSTNID} at ${describeLocation(location)}: not on board: ${missing.join(', ')}`,
      });
    }
    const direction = parseLineDirection(row.BB);
    if (!direction) {
      diagnostics.push({
        source: SOURCE,
        severity: 'warning',
        row: index,
        message: `Block ${row.CAVBLCKRSTNID} has unknown direction "${row.BB}"; treated as BOTH`,
      });
    }

    return [
      {
        id: row.CAVBLCKRSTNID,
        location,
        direction: direction ?? 'BOTH',
        department: row.CAVBLCKRSTNCODE.trim(),
        reason: row.CAVBLCKRSTNRMRK.trim(),
        permitted: defined({ start: parseCoaDateTime(row.CC), end: parseCoaDateTime(row.DD) }),
        actual: defined({ start: parseCoaDateTime(row.EE), end: parseCoaDateTime(row.FF) }),
        ...defined({
          clearedAt: parseCoaDateTime(row.CADCLEARTIME),
          permittedExtendedEnd: parseCoaDateTime(row.CADPRMTEXTNDENDTIME),
          extensionBurstFlag: emptyToUndefined(row.CACEXTNBRSTFLAG),
        }),
      },
    ];
  });
}
