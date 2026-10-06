// Test-only loader for the supplied JSON snapshot (reads from disk; the app fetches over HTTP).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatasetKey, RawChartSnapshot } from '../current-chart/adapters';

const files: Record<DatasetKey, string> = {
  movement: 'movement.json',
  boardDetails: 'BoardDetails.json',
  stationLines: 'StationLine.json',
  crew: 'crew.json',
  loco: 'loco.json',
  remarks: 'remark.json',
  blocks: 'block.json',
  cautions: 'caution.json',
};

export function readSuppliedJson(fileName: string): unknown {
  const path = fileURLToPath(new URL(`../data/${fileName}`, import.meta.url));
  const text = readFileSync(path, 'utf8');
  // Some exports carry a UTF-8 byte order mark.
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as unknown;
}

export function loadSuppliedSnapshot(): RawChartSnapshot {
  return Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, readSuppliedJson(file)]),
  ) as unknown as RawChartSnapshot;
}
