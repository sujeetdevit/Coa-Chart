import { blockRow, boardRow, cautionRow, movementRow, smallSnapshot } from '../../../tests/fixtures/rawRows';
import { parseCoaDateTime } from '../shared/coaDateTime';
import { normalizeSnapshot } from './normalizeSnapshot';

const ist = (text: string) => parseCoaDateTime(text);

describe('adapter edge cases', () => {
  it('sorts board rows by section then station sequence regardless of input order', () => {
    const model = normalizeSnapshot(
      smallSnapshot({
        boardDetails: [boardRow('ZZZ', 2, 1), boardRow('BBB', 1, 2), boardRow('AAA', 1, 1)],
      }),
    );
    expect(model.board.stations.map((s) => s.id)).toEqual(['1:AAA', '1:BBB', '2:ZZZ']);
  });

  it('sorts events by SEQNO and drops off-board stations', () => {
    const model = normalizeSnapshot(
      smallSnapshot({
        movement: [
          movementRow('T1', 3, 'CCC', { DPRTARVLTIME: '20-09-26 10:20:00' }),
          movementRow('T1', 1, 'AAA', { DPRTTIME: '20-09-26 10:00:00' }),
          movementRow('T1', 2, 'XXX', { DPRTTIME: '20-09-26 10:10:00' }),
        ],
      }),
    );
    expect(model.trains[0]?.events.map((e) => e.stationCode)).toEqual(['AAA', 'CCC']);
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'info', message: expect.stringContaining('XXX×1') as string }),
    );
  });

  it('omits trains whose events are all off the board', () => {
    const model = normalizeSnapshot(
      smallSnapshot({ movement: [movementRow('T1', 1, 'XXX', { DPRTTIME: '20-09-26 10:00:00' })] }),
    );
    expect(model.trains).toEqual([]);
  });

  it('treats an unknown PGFLAG as OTHER and reports it', () => {
    const model = normalizeSnapshot(
      smallSnapshot({
        movement: [movementRow('T1', 1, 'AAA', { PGFLAG: 'Z', DPRTTIME: '20-09-26 10:00:00' })],
      }),
    );
    expect(model.trains[0]?.category).toBe('OTHER');
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'warning', source: 'movement' }),
    );
  });

  it('maps reporting users, wrong-line running and blank train numbers', () => {
    const model = normalizeSnapshot(
      smallSnapshot({
        movement: [
          movementRow('T1', 1, 'AAA', {
            TRAINNO: '',
            ArvlUserID: 'GPSDATA',
            DepartureUserId: 'NKS',
            LINETYPE: 'REVS',
            LOSS: '-2',
            GAIN: '5',
            DPRTARVLTIME: '20-09-26 10:00:00',
            DPRTTIME: '20-09-26 10:05:00',
          }),
        ],
      }),
    );
    const train = model.trains[0];
    expect(train).not.toHaveProperty('number');
    expect(train?.events[0]).toMatchObject({
      arrivalSource: 'RTIS',
      departureSource: 'MANUAL',
      wrongLine: true,
      sectionGainLoss: -2,
      stationGainLoss: 5,
    });
  });

  it('honours an explicit snapshot time', () => {
    const asOf = ist('21-09-26 12:00:00') ?? 0;
    expect(normalizeSnapshot(smallSnapshot(), { asOf }).asOf).toBe(asOf);
  });

  it('skips a block with no location and reports it', () => {
    const model = normalizeSnapshot(smallSnapshot({ blocks: [blockRow({ FROMSTTN: '', TOSTTN: '' })] }));
    expect(model.blocks).toEqual([]);
    expect(model.diagnostics).toContainEqual(expect.objectContaining({ message: 'Block has no location' }));
  });

  it('keeps a block on unknown stations but reports it', () => {
    const model = normalizeSnapshot(smallSnapshot({ blocks: [blockRow({ TOSTTN: 'QQQ' })] }));
    expect(model.blocks).toHaveLength(1);
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('not on board: QQQ') as string }),
    );
  });

  it('defaults unknown caution direction to BOTH and keeps missing speeds absent', () => {
    const model = normalizeSnapshot(smallSnapshot({ cautions: [cautionRow({ DRTN: 'X' })] }));
    expect(model.cautions[0]?.direction).toBe('BOTH');
    expect(model.cautions[0]).toHaveProperty('passengerSpeed', 30);
    expect(model.cautions[0]).not.toHaveProperty('goodsSpeed');
  });

  it('reports conflicting board IDs instead of guessing', () => {
    const model = normalizeSnapshot(
      smallSnapshot({ cautions: [cautionRow({ BOARDID: 3 }), cautionRow({ BOARDID: 4 })] }),
    );
    expect(model.board.id).toBeUndefined();
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({ message: 'Conflicting board IDs in caution/remark data: 3, 4' }),
    );
  });

  it('survives a payload that is not an array', () => {
    const model = normalizeSnapshot(smallSnapshot({ movement: { not: 'rows' } }));
    expect(model.trains).toEqual([]);
    expect(model.diagnostics).toContainEqual(
      expect.objectContaining({ source: 'movement', severity: 'error' }),
    );
  });
});
