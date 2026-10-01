// URLs for the supplied snapshot files. Vite emits them as separate assets so the 3 MB of JSON
// is fetched at runtime rather than bundled into the app script.
import blocks from '../../../data/block.json?url';
import boardDetails from '../../../data/BoardDetails.json?url';
import cautions from '../../../data/caution.json?url';
import crew from '../../../data/crew.json?url';
import loco from '../../../data/loco.json?url';
import movement from '../../../data/movement.json?url';
import remarks from '../../../data/remark.json?url';
import stationLines from '../../../data/StationLine.json?url';
import { JsonFileDataSource, type SnapshotUrls } from './JsonFileDataSource';

export const suppliedSnapshotUrls: SnapshotUrls = {
  movement,
  boardDetails,
  stationLines,
  crew,
  loco,
  remarks,
  blocks,
  cautions,
};

export function createSuppliedSnapshotSource(): JsonFileDataSource {
  return new JsonFileDataSource(suppliedSnapshotUrls);
}
