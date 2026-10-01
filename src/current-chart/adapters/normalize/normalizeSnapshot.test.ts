import { loadSuppliedSnapshot } from '../../../tests/suppliedSnapshot';
import { parseCoaDateTime } from '../shared/coaDateTime';
import { normalizeSnapshot } from './normalizeSnapshot';

const ist = (text: string) => parseCoaDateTime(text);

// Expected values were computed independently from the JSON files (Python), not from this code.
describe('normalizeSnapshot with the supplied JSON', () => {
  const model = normalizeSnapshot(loadSuppliedSnapshot());
  const messages = model.diagnostics.map((d) => `${d.severity} ${d.source}: ${d.message}`);

  describe('board', () => {
    const { board } = model;

    it('orders 32 stations by section then station sequence', () => {
      expect(board.stations).toHaveLength(32);
      expect(board.stations.map((s) => s.code).slice(0, 4)).toEqual(['UMB', 'MOY', 'SHDM', 'DHMZ']);
      expect(board.stations.map((s) => s.code).slice(-4)).toEqual(['SZM', 'KURN', 'BHUL', 'ICB']);
      expect(board.stations.map((s) => s.displayIndex)).toEqual([...Array(32).keys()]);
      expect(board.sections.map((s) => [s.id, s.stationCodes.length])).toEqual([
        [20, 29],
        [32, 3],
      ]);
    });

    it('marks the first and last running station of each section as boundaries', () => {
      expect(board.stations.filter((s) => s.isSectionBoundary).map((s) => s.id)).toEqual([
        '20:UMB',
        '20:SZM',
        '32:KURN',
        '32:BHUL',
      ]);
    });

    it('classifies ICB as a siding with siding lines', () => {
      const icb = board.stations.find((s) => s.code === 'ICB');
      expect(icb?.kind).toBe('SIDING');
      expect(icb?.lines.map((l) => l.type)).toEqual(['SIDING', 'SIDING', 'SIDING', 'SIDING']);
    });

    it('attaches station lines in line-number order', () => {
      const lineNos = board.stations[0]?.lines.map((l) => l.lineNo) ?? [];
      expect(lineNos).toEqual([...lineNos].sort((a, b) => a - b));
      expect(board.stations.every((s) => s.lines.length >= 4)).toBe(true);
    });

    it('takes the board ID from the caution and remark rows', () => {
      expect(board.id).toBe(3);
    });

    it('reports exactly RUG and SNP as out-of-order reference distances', () => {
      const km = messages.filter((m) => m.includes('out of geographic order'));
      expect(km).toHaveLength(2);
      expect(km[0]).toContain('20:RUG');
      expect(km[1]).toContain('20:SNP');
    });
  });

  describe('trains', () => {
    it('builds 196 trains with 3,310 on-board events', () => {
      expect(model.trains).toHaveLength(196);
      expect(model.trains.reduce((n, t) => n + t.events.length, 0)).toBe(3310);
      expect(messages).toContainEqual(
        expect.stringContaining('Skipped events at stations not on this board'),
      );
    });

    it('maps PGFLAG to categories', () => {
      const counts = { GOODS: 0, PASSENGER: 0, OTHER: 0 };
      for (const t of model.trains) counts[t.category]++;
      expect(counts).toEqual({ GOODS: 58, PASSENGER: 131, OTHER: 7 });
    });

    it('normalises the first train', () => {
      const train = model.trains[0];
      expect(train).toMatchObject({
        id: 'AADRNDLSUMB 190926492',
        number: '22448',
        name: 'AADR-NDLS VANDE BHARAT',
        category: 'PASSENGER',
        colour: 'DeepPink',
      });
      expect(train?.events[0]).toMatchObject({
        sequence: 1,
        stationCode: 'UMB',
        sectionId: 20,
        direction: 'DN',
        arrival: ist('20-09-26 16:13:30'),
        departure: ist('20-09-26 16:15:30'),
        scheduledArrival: ist('20-09-26 16:13:00'),
        sectionGainLoss: 0,
        stationGainLoss: 0,
        lineNo: 3,
        arrivalSource: 'REMLOT',
        wrongLine: false,
      });
      // Blank LOSS/GAIN and null speed become absent, not undefined-valued or zero.
      const shdm = train?.events[1];
      expect(shdm).not.toHaveProperty('sectionGainLoss');
      expect(shdm).toHaveProperty('speedKmph', 123);
      expect(train?.events[0]).not.toHaveProperty('speedKmph');
    });

    it('drops the -128 speed sentinel', () => {
      const speeds = model.trains.flatMap((t) =>
        t.events.flatMap((e) => (e.speedKmph === undefined ? [] : [e.speedKmph])),
      );
      expect(speeds).toHaveLength(3013);
      expect(Math.min(...speeds)).toBeGreaterThan(0);
    });

    it('attaches crew to the 3 trains that have it, and only relevant locos', () => {
      expect(model.trains.filter((t) => t.crew.length > 0)).toHaveLength(3);
      expect(model.trains.reduce((n, t) => n + t.crew.length, 0)).toBe(8);
      expect(model.trains.reduce((n, t) => n + t.locos.length, 0)).toBe(238);
    });
  });

  it('sets the snapshot time to the end of continuous reporting, ignoring stragglers', () => {
    // Reporting is dense until 21-09 00:25; three isolated reports follow (01:32, 03:05, 07:54).
    expect(model.asOf).toBe(ist('21-09-26 00:25:00'));
    expect(messages).toContainEqual(expect.stringContaining('3 later isolated report(s)'));
  });

  it('reports the 6 stale trains', () => {
    const stale = messages.find((m) => m.includes('more than 48 h'));
    expect(stale).toContain('6 train(s)');
    for (const id of ['SVDKNDLSDLI 201225612', 'UMB KKDE2612242331394', 'GZB DUK DLI 110926497']) {
      expect(stale).toContain(id);
    }
  });

  it('maps block permitted/actual times (CC/DD permitted, EE/FF actual)', () => {
    expect(model.blocks).toHaveLength(13);
    expect(model.blocks.filter((b) => b.location.kind === 'station')).toHaveLength(4);
    expect(model.blocks[0]).toMatchObject({
      id: 'DLI09261488',
      location: { kind: 'station', sectionId: 20, stationCode: 'SNP' },
      direction: 'UP',
      department: 'SIGNAL',
      permitted: { start: ist('20-09-26 10:00:00'), end: ist('20-09-26 10:35:00') },
      actual: { start: ist('20-09-26 13:19:00'), end: ist('20-09-26 13:54:00') },
      clearedAt: ist('20-09-26 13:54:00'),
    });
  });

  it('maps cautions with block-section locations and optional speeds', () => {
    expect(model.cautions).toHaveLength(39);
    expect(model.cautions[0]).toMatchObject({
      location: { kind: 'blockSection', sectionId: 32, fromStationCode: 'KURN', toStationCode: 'BHUL' },
      direction: 'BOTH',
      passengerSpeed: 30,
      goodsSpeed: 30,
      kmLocation: '107/0-106/0',
    });
    expect(model.cautions.filter((c) => c.passengerSpeed === undefined)).toHaveLength(8);
  });

  it('maps train remarks and notes the off-board location', () => {
    expect(model.trainRemarks).toHaveLength(9);
    expect(messages).toContainEqual(expect.stringContaining('"PCRG" is not on this board'));
  });

  it('has no validation warnings beyond the known data issues', () => {
    expect(model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(model.diagnostics.filter((d) => d.severity === 'warning')).toHaveLength(2); // RUG, SNP
  });

  it('leaves datasets without source data empty', () => {
    expect(model.unusualOccurrences).toEqual([]);
    expect(model.tsl).toEqual([]);
    expect(model.gpsLocoMovements).toEqual([]);
    expect(model.chartRemarks).toEqual([]);
    expect(model.epenMessages).toEqual([]);
  });
});
