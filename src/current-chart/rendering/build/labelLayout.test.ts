import { wrapLabel } from './buildMovementLayer';
import { layoutLabels } from './labelLayout';

describe('layoutLabels', () => {
  const label = (id: string, anchorX: number, anchorY: number) => ({
    id,
    anchorX,
    anchorY,
    width: 40,
    height: 14,
  });

  it('places a lone label above-right of its anchor', () => {
    expect(layoutLabels([label('a', 100, 100)])[0]).toMatchObject({ x: 103, y: 83, displaced: false });
  });

  it('moves a colliding label above, then below', () => {
    const placed = layoutLabels([label('a', 100, 100), label('b', 105, 100), label('c', 110, 100)]);
    const byId = Object.fromEntries(placed.map((p) => [p.id, p]));
    expect(byId.a).toMatchObject({ y: 83, displaced: false });
    expect(byId.b).toMatchObject({ y: 83 - 17, displaced: true });
    expect(byId.c).toMatchObject({ y: 83 + 17, displaced: true });
  });

  it('leaves non-overlapping labels alone', () => {
    const placed = layoutLabels([label('a', 100, 100), label('b', 300, 100)]);
    expect(placed.every((p) => !p.displaced)).toBe(true);
  });
});

describe('wrapLabel', () => {
  it('keeps short labels on one line', () => {
    expect(wrapLabel('22448', 10, 3)).toEqual(['22448']);
  });

  it('wraps on spaces and splits long words', () => {
    expect(wrapLabel('SVDK-NDLS VANDE BHARAT', 10, 3)).toEqual(['SVDK-NDLS', 'VANDE', 'BHARAT']);
    expect(wrapLabel('ABCDEFGHIJKLMN', 10, 3)).toEqual(['ABCDEFGHIJ', 'KLMN']);
  });

  it('truncates beyond the line limit', () => {
    expect(wrapLabel('AAAA BBBB CCCC DDDD', 4, 2)).toEqual(['AAAA', 'BBB…']);
  });
});
