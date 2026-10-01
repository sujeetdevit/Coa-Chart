import { boardRow, smallSnapshot } from '../../tests/fixtures/rawRows';
import { smallBoard } from '../../tests/fixtures/smallModel';
import { normalizeSnapshot } from '../adapters';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { buildStationLayout, nearestPositionIndex } from './stationLayout';

const spacing = DEFAULT_CHART_CONFIG.stationSpacing;

describe('buildStationLayout', () => {
  it('accumulates display distances and widens the gap between sections', () => {
    const layout = buildStationLayout(smallBoard(), spacing);
    expect(layout.positions.map((p) => [p.station.id, p.offset])).toEqual([
      ['1:AAA', 3],
      ['1:BBB', 11],
      ['1:CCC', 19],
      ['2:DDD', 31], // 19 + 8 × 1.5
    ]);
    expect(layout.totalUnits).toBe(34);
    expect(layout.byId.get('1:CCC')?.offset).toBe(19);
  });

  it('clamps display distance to [minGap, maxGap] and uses the compact gap for class X', () => {
    const board = normalizeSnapshot(
      smallSnapshot({
        boardDetails: [
          boardRow('AAA', 1, 1),
          boardRow('BBB', 1, 2, { MANDSPLDIST: 0.5 }),
          boardRow('CCC', 1, 3, { MANDSPLDIST: 40 }),
          boardRow('XXX', 1, 4, { MACCLASSFLAG: 'X', MANDSPLDIST: 9 }),
        ],
      }),
    ).board;
    const offsets = buildStationLayout(board, spacing).positions.map((p) => p.offset);
    expect(offsets).toEqual([3, 3 + 4, 3 + 4 + 15, 3 + 4 + 15 + 2]);
  });

  it('handles an empty board', () => {
    const layout = buildStationLayout({ sections: [], stations: [] }, spacing);
    expect(layout.positions).toEqual([]);
    expect(layout.totalUnits).toBe(3);
    expect(nearestPositionIndex(layout, 10)).toBe(-1);
  });
});

describe('nearestPositionIndex', () => {
  const layout = buildStationLayout(smallBoard(), spacing); // offsets 3, 11, 19, 31

  it.each([
    [-50, 0],
    [3, 0],
    [6.9, 0],
    [7, 0], // exact midpoint goes to the upper station
    [7.1, 1],
    [15.5, 2],
    [25, 2],
    [25.1, 3],
    [1000, 3],
  ])('offset %d → index %d', (offset, index) => {
    expect(nearestPositionIndex(layout, offset)).toBe(index);
  });
});
