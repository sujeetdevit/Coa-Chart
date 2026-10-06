import { Refresher, type RefreshState } from './refresh';

/** A load function whose calls are settled by hand. */
function manualLoader<T>() {
  const calls: { resolve: (value: T) => void; reject: (error: Error) => void; signal: AbortSignal }[] = [];
  const load = vi.fn(
    (signal: AbortSignal) =>
      new Promise<T>((resolve, reject) => {
        calls.push({ resolve, reject, signal });
      }),
  );
  return { load, calls };
}

function ready<T>(state: RefreshState<T>) {
  if (state.status !== 'ready') throw new Error(`expected ready, got ${state.status}`);
  return state;
}

describe('Refresher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts loading, then holds the data and when it was loaded', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    const seen: string[] = [];
    refresher.subscribe(() => seen.push(refresher.getState().status));

    const done = refresher.reload();
    expect(refresher.getState()).toEqual({ status: 'loading' });
    calls[0]?.resolve('a');
    await done;

    expect(refresher.getState()).toEqual({
      status: 'ready',
      data: 'a',
      loadedAt: 1_000_000,
      refreshing: false,
    });
    expect(seen).toEqual(['loading', 'ready']);
  });

  it('reports a failed first load, and recovers on retry', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);

    const first = refresher.reload();
    calls[0]?.reject(new Error('server down'));
    await first;
    expect(refresher.getState()).toEqual({ status: 'failed', error: 'server down' });

    const retry = refresher.reload();
    calls[1]?.resolve('a');
    await retry;
    expect(ready(refresher.getState()).data).toBe('a');
  });

  it('keeps the last good data when a refresh fails, and clears the error on the next success', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    const first = refresher.reload();
    calls[0]?.resolve('a');
    await first;

    vi.setSystemTime(1_060_000);
    const second = refresher.reload();
    expect(ready(refresher.getState()).refreshing).toBe(true);
    calls[1]?.reject(new Error('timeout'));
    await second;
    expect(refresher.getState()).toEqual({
      status: 'ready',
      data: 'a',
      loadedAt: 1_000_000,
      refreshing: false,
      refreshError: 'timeout',
    });

    const third = refresher.reload();
    calls[2]?.resolve('b');
    await third;
    expect(refresher.getState()).toEqual({
      status: 'ready',
      data: 'b',
      loadedAt: 1_060_000,
      refreshing: false,
    });
  });

  it('does not start a second load while one is running', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);

    const a = refresher.reload();
    const b = refresher.reload();
    expect(load).toHaveBeenCalledTimes(1);
    calls[0]?.resolve('a');
    await Promise.all([a, b]);
  });

  it('refreshes on the interval, counted from the end of the previous load', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    refresher.setAutoRefresh(180_000);
    const first = refresher.reload();
    calls[0]?.resolve('a');
    await first;

    await vi.advanceTimersByTimeAsync(179_999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);

    // Still loading: no further load is started however long it takes.
    await vi.advanceTimersByTimeAsync(600_000);
    expect(load).toHaveBeenCalledTimes(2);
    calls[1]?.resolve('b');
    await vi.advanceTimersByTimeAsync(180_000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('keeps refreshing after a failure, and stops when auto refresh is turned off', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    refresher.setAutoRefresh(60_000);
    const first = refresher.reload();
    calls[0]?.reject(new Error('down'));
    await first;

    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(2);
    calls[1]?.resolve('a');
    await vi.advanceTimersByTimeAsync(0);

    refresher.setAutoRefresh(undefined);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('holds refreshes while paused and catches up on resume', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    refresher.setAutoRefresh(60_000);
    const first = refresher.reload();
    calls[0]?.resolve('a');
    await first;

    refresher.setPaused(true);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(load).toHaveBeenCalledTimes(1);

    refresher.setPaused(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('waits out the rest of the interval when resumed early', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    refresher.setAutoRefresh(60_000);
    const first = refresher.reload();
    calls[0]?.resolve('a');
    await first;

    refresher.setPaused(true);
    await vi.advanceTimersByTimeAsync(20_000);
    refresher.setPaused(false);
    await vi.advanceTimersByTimeAsync(39_999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the data identity when the source says nothing changed', async () => {
    const model = { trains: 3 };
    const refresher = new Refresher(() => Promise.resolve(model));
    await refresher.reload();
    const before = ready(refresher.getState());

    vi.setSystemTime(1_180_000);
    await refresher.reload();
    const after = ready(refresher.getState());
    expect(after.data).toBe(before.data);
    expect(after.loadedAt).toBe(1_180_000);
  });

  it('aborts the running load and ignores its result when stopped', async () => {
    const { load, calls } = manualLoader<string>();
    const refresher = new Refresher(load);
    refresher.setAutoRefresh(60_000);
    void refresher.reload();

    refresher.stop();
    expect(calls[0]?.signal.aborted).toBe(true);
    calls[0]?.resolve('late');
    await vi.advanceTimersByTimeAsync(600_000);
    expect(refresher.getState()).toEqual({ status: 'loading' });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
