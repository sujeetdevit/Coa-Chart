import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { parseCoaDateTime } from './shared/coaDateTime';
import { validateSnapshot } from './validateSnapshot';

describe('validateSnapshot against the supplied JSON', () => {
  const { snapshot, diagnostics } = validateSnapshot(loadSuppliedSnapshot());

  it('accepts every row of every supplied file', () => {
    expect(diagnostics).toEqual([]);
    expect({
      movement: snapshot.movement.length,
      boardDetails: snapshot.boardDetails.length,
      stationLines: snapshot.stationLines.length,
      crew: snapshot.crew.length,
      loco: snapshot.loco.length,
      remarks: snapshot.remarks.length,
      blocks: snapshot.blocks.length,
      cautions: snapshot.cautions.length,
    }).toEqual({
      movement: 3390,
      boardDetails: 32,
      stationLines: 146,
      crew: 53,
      loco: 8932,
      remarks: 9,
      blocks: 13,
      cautions: 39,
    });
  });

  it('can parse every non-null movement timestamp', () => {
    const unparsed = snapshot.movement.flatMap((row) =>
      [row.DPRTARVLTIME, row.DPRTTIME, row.SCHARVL, row.SCHDPRT].filter(
        (value) => value !== null && parseCoaDateTime(value) === undefined,
      ),
    );
    expect(unparsed).toEqual([]);
  });

  it('can parse every block and caution timestamp', () => {
    const values = [
      ...snapshot.blocks.flatMap((b) => [b.CC, b.DD, b.EE, b.FF, b.CADCLEARTIME]),
      ...snapshot.cautions.flatMap((c) => [c.FROMDATETIME, c.TODATETIME]),
    ];
    expect(values.filter((v) => v !== null && parseCoaDateTime(v) === undefined)).toEqual([]);
  });
});
