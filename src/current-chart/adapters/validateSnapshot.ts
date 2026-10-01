import type { AdapterDiagnostic } from '../domain';
import {
  blockRowSchema,
  boardDetailsRowSchema,
  cautionRowSchema,
  crewRowSchema,
  locoRowSchema,
  movementRowSchema,
  remarkRowSchema,
  stationLineRowSchema,
  type BlockRow,
  type BoardDetailsRow,
  type CautionRow,
  type CrewRow,
  type LocoRow,
  type MovementRow,
  type RemarkRow,
  type StationLineRow,
} from './schemas';
import { validateRows, type ValidatedRows } from './shared/validateRows';
import type { RawChartSnapshot } from './types';

export interface ValidatedSnapshot {
  movement: MovementRow[];
  boardDetails: BoardDetailsRow[];
  stationLines: StationLineRow[];
  crew: CrewRow[];
  loco: LocoRow[];
  remarks: RemarkRow[];
  blocks: BlockRow[];
  cautions: CautionRow[];
}

export interface SnapshotValidation {
  snapshot: ValidatedSnapshot;
  diagnostics: AdapterDiagnostic[];
}

/** Validates every dataset of a raw snapshot against its row schema. */
export function validateSnapshot(raw: RawChartSnapshot): SnapshotValidation {
  const diagnostics: AdapterDiagnostic[] = [];
  const collect = <T>(result: ValidatedRows<T>): T[] => {
    diagnostics.push(...result.diagnostics);
    return result.rows;
  };

  const snapshot: ValidatedSnapshot = {
    movement: collect(validateRows('movement', movementRowSchema, raw.movement)),
    boardDetails: collect(validateRows('boardDetails', boardDetailsRowSchema, raw.boardDetails)),
    stationLines: collect(validateRows('stationLines', stationLineRowSchema, raw.stationLines)),
    crew: collect(validateRows('crew', crewRowSchema, raw.crew)),
    loco: collect(validateRows('loco', locoRowSchema, raw.loco)),
    remarks: collect(validateRows('remarks', remarkRowSchema, raw.remarks)),
    blocks: collect(validateRows('blocks', blockRowSchema, raw.blocks)),
    cautions: collect(validateRows('cautions', cautionRowSchema, raw.cautions)),
  };
  return { snapshot, diagnostics };
}
