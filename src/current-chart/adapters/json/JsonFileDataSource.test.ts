import { DATASET_KEYS } from '../types';
import { JsonFileDataSource, type SnapshotUrls } from './JsonFileDataSource';

const urls = Object.fromEntries(DATASET_KEYS.map((k) => [k, `/data/${k}.json`])) as SnapshotUrls;

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** A fetch that answers every dataset with one row naming its URL, except where overridden. */
function fakeFetch(overrides: Record<string, () => Response | Promise<Response>> = {}) {
  return vi.fn<typeof fetch>((input) => {
    const url = urlOf(input);
    const override = Object.entries(overrides).find(([part]) => url.includes(part))?.[1];
    return Promise.resolve(override ? override() : Response.json([{ from: url }]));
  });
}

describe('JsonFileDataSource', () => {
  it('fetches every dataset and returns the payloads keyed by dataset', async () => {
    const fetchFn = fakeFetch();
    const snapshot = await new JsonFileDataSource(urls, fetchFn).load({});

    expect(fetchFn).toHaveBeenCalledTimes(DATASET_KEYS.length);
    expect(snapshot.movement).toEqual([{ from: '/data/movement.json' }]);
    expect(snapshot.cautions).toEqual([{ from: '/data/cautions.json' }]);
    expect(snapshot.loadErrors).toBeUndefined();
  });

  it('keeps going when an optional dataset fails, and says which and why', async () => {
    const fetchFn = fakeFetch({
      crew: () => new Response('nope', { status: 404 }),
      loco: () => new Response('<html>', { status: 200 }),
      remarks: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    const snapshot = await new JsonFileDataSource(urls, fetchFn).load({});

    expect(snapshot.crew).toEqual([]);
    expect(snapshot.loco).toEqual([]);
    expect(snapshot.remarks).toEqual([]);
    expect(snapshot.movement).toEqual([{ from: '/data/movement.json' }]);
    expect(snapshot.loadErrors).toEqual({
      crew: 'Failed to load crew from /data/crew.json: HTTP 404',
      loco: 'Failed to load loco from /data/loco.json: the response is not valid JSON',
      remarks: 'Failed to load remarks from /data/remarks.json: Failed to fetch',
    });
  });

  it.each(['boardDetails', 'stationLines'])('rejects when the required %s dataset fails', async (key) => {
    const fetchFn = fakeFetch({ [key]: () => new Response('down', { status: 503 }) });

    await expect(new JsonFileDataSource(urls, fetchFn).load({})).rejects.toThrow(
      `Failed to load ${key} from /data/${key}.json: HTTP 503`,
    );
  });

  it('returns the same payload object when a dataset has not changed', async () => {
    let movement = [{ n: 1 }];
    const fetchFn = fakeFetch({ movement: () => Response.json(movement) });
    const source = new JsonFileDataSource(urls, fetchFn);

    const first = await source.load({});
    const second = await source.load({});
    expect(second.movement).toBe(first.movement);
    expect(second.crew).toBe(first.crew);

    movement = [{ n: 2 }];
    const third = await source.load({});
    expect(third.movement).toEqual([{ n: 2 }]);
    expect(third.movement).not.toBe(first.movement);
    expect(third.crew).toBe(first.crew);
  });

  it('builds URLs from the query when given a function', async () => {
    const fetchFn = fakeFetch();
    const source = new JsonFileDataSource(
      { ...urls, movement: (q) => `/api/movement?board=${q.boardId ?? ''}` },
      fetchFn,
    );

    const snapshot = await source.load({ boardId: 3 });
    expect(snapshot.movement).toEqual([{ from: '/api/movement?board=3' }]);
  });

  it('rejects when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const source = new JsonFileDataSource(urls, fakeFetch());

    await expect(source.load({}, controller.signal)).rejects.toThrow();
  });
});
