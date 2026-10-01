import { readSuppliedJson } from '../../../tests/suppliedSnapshot';
import type { Station } from '../../domain';
import { SampleForecastProvider, parseSample } from './SampleForecastProvider';
import { SampleMsmProvider } from './SampleMsmProvider';
import { normalizeSnapshot } from '../normalize/normalizeSnapshot';
import { loadSuppliedSnapshot } from '../../../tests/suppliedSnapshot';

const raw = readSuppliedJson('forecast.sample.json');

describe('SampleForecastProvider', () => {
  it('parses the generated sample: 15 trains, times in order', () => {
    const forecasts = parseSample(raw);
    expect(forecasts.size).toBe(15);
    for (const f of forecasts.values()) {
      const times = f.points
        .flatMap((p) => [p.arrival, p.departure])
        .filter((t): t is number => t !== undefined);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it('every sample train exists in the snapshot and every point is on the board', () => {
    const model = normalizeSnapshot(loadSuppliedSnapshot());
    const ids = new Set(model.trains.map((t) => t.id));
    const stations = new Set(model.board.stations.map((s) => s.id));
    for (const [id, f] of parseSample(raw)) {
      expect(ids.has(id)).toBe(true);
      for (const p of f.points) expect(stations.has(`${p.sectionId}:${p.stationCode}`)).toBe(true);
    }
  });

  it('labels results as sample data and filters to requested trains', async () => {
    const provider = new SampleForecastProvider(() => Promise.resolve(raw));
    const model = normalizeSnapshot(loadSuppliedSnapshot());
    const [first] = parseSample(raw).keys();
    const result = await provider.single({ model, trainIds: [first ?? ''], halts: [] });
    expect(result.source).toBe('sample');
    expect(result.message).toMatch(/not the COA forecast algorithm/);
    expect([...result.forecasts.keys()]).toEqual([first]);
    expect(result.forecasts.get(first ?? '')?.kind).toBe('SINGLE');
  });

  it('records WFS reports in memory', async () => {
    const provider = new SampleForecastProvider(() => Promise.resolve(raw));
    const r = await provider.reportWrongForecast({ at: 0, forecasts: parseSample(raw) });
    expect(r.saved).toBe(true);
    expect(provider.wrongForecastReports).toEqual([{ at: 0, trainCount: 15 }]);
  });
});

describe('SampleMsmProvider', () => {
  const station = (code: string, km: number): Station => ({
    id: `1:${code}`,
    code,
    sectionId: 1,
    displayIndex: 0,
    kind: 'BLOCK',
    isSectionBoundary: false,
    displayDistance: 8,
    kmFromReference: km,
    actualDistance: 0,
    lines: [],
  });

  it('runs from 0 km at departure to the section length at arrival, stopping at both ends', async () => {
    const result = await new SampleMsmProvider().midSection({
      train: { id: 'T', name: 'T', category: 'GOODS', colour: 'Green', events: [], crew: [], locos: [] },
      from: station('AAA', 100),
      to: station('BBB', 92),
      departure: 0,
      arrival: 10 * 60_000,
    });
    const { samples } = result;
    expect(result.source).toBe('sample');
    expect(samples[0]).toMatchObject({ at: 0, distanceKm: 0, speedKmph: 0 });
    expect(samples[samples.length - 1]).toMatchObject({ at: 600_000, distanceKm: 8, speedKmph: 0 });
    const distances = samples.map((s) => s.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(Math.max(...samples.map((s) => s.speedKmph))).toBeGreaterThan(48); // average is 48 km/h
  });
});
