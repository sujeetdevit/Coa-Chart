import type { RawChartSnapshot } from '../types';
import { JsonFileDataSource, type SnapshotUrls } from './JsonFileDataSource';

const keys: (keyof RawChartSnapshot)[] = [
  'movement',
  'boardDetails',
  'stationLines',
  'crew',
  'loco',
  'remarks',
  'blocks',
  'cautions',
];
const urls = Object.fromEntries(keys.map((k) => [k, `/data/${k}.json`])) as SnapshotUrls;

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

describe('JsonFileDataSource', () => {
  it('fetches every dataset and returns the payloads keyed by dataset', async () => {
    const fetchFn = vi.fn<typeof fetch>((input) => Promise.resolve(Response.json([{ from: urlOf(input) }])));
    const source = new JsonFileDataSource(urls, fetchFn);

    const snapshot = await source.load({});

    expect(fetchFn).toHaveBeenCalledTimes(keys.length);
    expect(snapshot.movement).toEqual([{ from: '/data/movement.json' }]);
    expect(snapshot.cautions).toEqual([{ from: '/data/cautions.json' }]);
  });

  it('rejects when a file fails to load', async () => {
    const fetchFn = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        urlOf(input).includes('crew') ? new Response('nope', { status: 404 }) : Response.json([]),
      ),
    );
    const source = new JsonFileDataSource(urls, fetchFn);

    await expect(source.load({})).rejects.toThrow('Failed to load crew from /data/crew.json: HTTP 404');
  });
});
