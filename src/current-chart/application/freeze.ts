/**
 * Manual §11.1 Freeze: "stop updating of current chart while dragging chart for analysis".
 * While frozen, new data is held back (the user can still pan, zoom and inspect what is shown);
 * unfreezing shows the latest data received in the meantime.
 */
export interface FreezeState<T> {
  frozen: boolean;
  shown: T;
  /** Latest data that arrived while frozen. */
  pending?: T;
}

export type FreezeAction<T> = { type: 'data'; data: T } | { type: 'freeze' } | { type: 'unfreeze' };

export function freezeReducer<T>(state: FreezeState<T>, action: FreezeAction<T>): FreezeState<T> {
  switch (action.type) {
    case 'data':
      return state.frozen ? { ...state, pending: action.data } : { frozen: false, shown: action.data };
    case 'freeze':
      return state.frozen ? state : { ...state, frozen: true };
    case 'unfreeze':
      return { frozen: false, shown: state.pending ?? state.shown };
  }
}
