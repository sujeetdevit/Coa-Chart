import type { AdapterDiagnostic, Board, Caution } from '../../domain';
import type { CautionRow } from '../schemas';
import { parseCoaDateTime } from '../shared/coaDateTime';
import { describeLocation, parseLocationCode, stationsMissingFromBoard } from './locationAdapter';
import { defined, emptyToUndefined, parseLineDirection } from './shared';

const SOURCE = 'cautions';

export function adaptCautions(rows: CautionRow[], board: Board, diagnostics: AdapterDiagnostic[]): Caution[] {
  return rows.flatMap((row, index): Caution[] => {
    const warn = (message: string) => {
      diagnostics.push({ source: SOURCE, severity: 'warning', row: index, message });
    };

    const location = parseLocationCode(row.BLOCKSECTION, row.SUBSCTNUMB);
    const from = parseCoaDateTime(row.FROMDATETIME);
    if (!location || from === undefined) {
      warn(`Caution skipped: unreadable location "${row.BLOCKSECTION}" or start "${row.FROMDATETIME}"`);
      return [];
    }
    const missing = stationsMissingFromBoard(location, board);
    if (missing.length > 0) {
      warn(`Caution at ${describeLocation(location)}: not on board: ${missing.join(', ')}`);
    }
    const direction = parseLineDirection(row.DRTN);
    if (!direction) warn(`Caution has unknown direction "${row.DRTN}"; treated as BOTH`);

    return [
      {
        location,
        sectionName: row.SECTION,
        direction: direction ?? 'BOTH',
        kmLocation: row.LOCATION,
        from,
        reason: row.REASONDESC.trim(),
        department: row.DEPTCODE.trim(),
        inForce: row.DAYHH,
        ...defined({
          to: parseCoaDateTime(row.TODATETIME),
          lineNo: emptyToUndefined(row.LINENO),
          passengerSpeed: row.PASSPEED ?? undefined,
          goodsSpeed: row.GDSPEED ?? undefined,
        }),
      },
    ];
  });
}
