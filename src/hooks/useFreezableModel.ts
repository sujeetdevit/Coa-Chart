import { useReducer, useState } from 'react';
import { freezeReducer, type FreezeState } from '../current-chart/application/freeze';
import type { CurrentChartModel } from '../current-chart/domain';

/** Applies Freeze to incoming models: while frozen, new data waits until unfreeze. */
export function useFreezableModel(model: CurrentChartModel) {
  const [state, dispatch] = useReducer(
    freezeReducer<CurrentChartModel>,
    model,
    (shown): FreezeState<CurrentChartModel> => ({ frozen: false, shown }),
  );

  // Feed new data in as it arrives (state adjustment during render, guarded by identity).
  const [seen, setSeen] = useState(model);
  if (seen !== model) {
    setSeen(model);
    dispatch({ type: 'data', data: model });
  }

  return {
    model: state.shown,
    frozen: state.frozen,
    hasPending: state.pending !== undefined,
    setFrozen: (frozen: boolean) => {
      dispatch({ type: frozen ? 'freeze' : 'unfreeze' });
    },
  };
}
