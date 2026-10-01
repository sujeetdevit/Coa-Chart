import { type AdapterDiagnostic, type Board, type TrainRemark } from '../../domain';
import type { RemarkRow } from '../schemas';
import { parseCoaDateTime } from '../shared/coaDateTime';
import { defined, emptyToUndefined } from './shared';

const SOURCE = 'remarks';

/**
 * Train remarks. CAVNEWTRAINNAME holds the station code or block section the remark is placed
 * against (legacy behaviour), despite its name.
 */
export function adaptTrainRemarks(
  rows: RemarkRow[],
  board: Board,
  diagnostics: AdapterDiagnostic[],
): TrainRemark[] {
  const boardCodes = new Set(board.stations.map((s) => s.code));
  return rows.flatMap((row, index): TrainRemark[] => {
    const at = parseCoaDateTime(row.CADEVENTRPTGTIME);
    if (at === undefined) {
      diagnostics.push({ source: SOURCE, severity: 'warning', row: index, message: 'Remark has no time' });
      return [];
    }
    const locationCode = row.CAVNEWTRAINNAME.trim();
    const offBoard = locationCode.split('-').filter((code) => !boardCodes.has(code));
    if (offBoard.length > 0) {
      diagnostics.push({
        source: SOURCE,
        severity: 'info',
        row: index,
        message: `Remark location "${locationCode}" is not on this board`,
      });
    }
    return [
      {
        trainId: row.CAVTRAINID,
        trainName: row.TrainName.trim(),
        locationCode,
        remark: row.CAVREMARK.trim(),
        userId: row.CAVUSERID,
        at,
        ...defined({ event: emptyToUndefined(row.EVENT) }),
      },
    ];
  });
}
