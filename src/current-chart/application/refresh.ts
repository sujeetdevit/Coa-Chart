/**
 * Loading and refreshing chart data, independent of React and of where the data comes from.
 *
 * Manual §3.1 "Auto Refresh Enable" (default N) and "Chart Idle Refresh Time" (no default given).
 * A failed refresh never takes away the data already on screen: the last good data stays and
 * the failure is reported next to it.
 */
export type RefreshState<T> =
  | { status: 'loading' }
  /** The first load failed: there is nothing to show yet. */
  | { status: 'failed'; error: string }
  | {
      status: 'ready';
      data: T;
      /** When `data` was last confirmed with the source (clock time, ms). */
      loadedAt: number;
      refreshing: boolean;
      /** Why the latest refresh failed; cleared by the next successful one. */
      refreshError?: string;
    };

export interface RefresherOptions {
  now?: () => number;
}

export class Refresher<T> {
  private state: RefreshState<T> = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private inFlight: { promise: Promise<void>; controller: AbortController } | undefined;
  private intervalMs: number | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** When the next automatic refresh is due, if one is wanted. */
  private dueAt: number | undefined;
  private paused = false;
  private stopped = false;

  /**
   * @param loadFn Loads the data. Resolving with the same object as last time means "unchanged":
   *   `data` keeps its identity, so nothing downstream is rebuilt.
   */
  constructor(
    private readonly loadFn: (signal: AbortSignal) => Promise<T>,
    options: RefresherOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  getState = (): RefreshState<T> => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Loads now. If a load is already running, waits for that one instead of starting another. */
  reload = (): Promise<void> => {
    if (this.stopped) return Promise.resolve();
    if (this.inFlight) return this.inFlight.promise;
    this.clearTimer();
    const controller = new AbortController();
    if (this.state.status === 'ready') this.setState({ ...this.state, refreshing: true });
    else this.setState({ status: 'loading' });

    const promise = this.loadFn(controller.signal)
      .then(
        (data) => {
          if (controller.signal.aborted) return;
          this.setState({ status: 'ready', data, loadedAt: this.now(), refreshing: false });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : String(error);
          this.setState(
            this.state.status === 'ready'
              ? { ...this.state, refreshing: false, refreshError: message }
              : { status: 'failed', error: message },
          );
        },
      )
      .finally(() => {
        if (this.inFlight?.controller !== controller) return;
        this.inFlight = undefined;
        this.scheduleNext();
      });
    this.inFlight = { promise, controller };
    return promise;
  };

  /** Refresh every `intervalMs` after the previous load finishes; `undefined` turns it off. */
  setAutoRefresh(intervalMs: number | undefined): void {
    this.intervalMs = intervalMs !== undefined && intervalMs > 0 ? intervalMs : undefined;
    this.clearTimer();
    this.scheduleNext();
  }

  /**
   * Holds automatic refreshes (e.g. while the page is hidden). On resume, a refresh that came
   * due in the meantime runs straight away.
   */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      if (this.timer !== undefined) clearTimeout(this.timer);
      this.timer = undefined;
    } else {
      this.arm();
    }
  }

  /** Cancels any load and timer. The refresher cannot be used afterwards. */
  stop(): void {
    this.stopped = true;
    this.clearTimer();
    this.inFlight?.controller.abort();
    this.inFlight = undefined;
    this.listeners.clear();
  }

  private scheduleNext(): void {
    if (this.stopped || this.inFlight || this.intervalMs === undefined) return;
    this.dueAt = this.now() + this.intervalMs;
    this.arm();
  }

  private arm(): void {
    if (this.stopped || this.paused || this.inFlight || this.dueAt === undefined) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        void this.reload();
      },
      Math.max(0, this.dueAt - this.now()),
    );
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.dueAt = undefined;
  }

  private setState(state: RefreshState<T>): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
