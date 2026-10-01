import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ForecastProvider, ManualHalt } from '../current-chart/application/forecast/ForecastProvider';
import {
  forecastWorkflowReducer,
  INITIAL_FORECAST_STATE,
} from '../current-chart/application/forecast/forecastWorkflow';
import type { CurrentChartModel, EpochMs } from '../current-chart/domain';

/** Runs the forecast bar commands against a provider and keeps the workflow state. */
export function useForecastWorkflow(
  provider: ForecastProvider,
  model: CurrentChartModel,
  visibleTrainIds: string[],
) {
  const [state, dispatch] = useReducer(forecastWorkflowReducer, INITIAL_FORECAST_STATE);
  const latest = useRef({ state, model, visibleTrainIds });
  useEffect(() => {
    latest.current = { state, model, visibleTrainIds };
  });

  const fail = (error: unknown) => {
    dispatch({
      type: 'message',
      message: `Forecast failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  };

  const basic = useCallback(() => {
    const { model: m, visibleTrainIds: ids, state: s } = latest.current;
    dispatch({ type: 'busy' });
    provider
      .basic({ model: m, trainIds: ids, halts: s.halts })
      .then((result) => {
        dispatch({ type: 'result', mode: 'basic', result });
      })
      .catch(fail);
  }, [provider]);

  const full = useCallback(
    (halts?: ManualHalt[]) => {
      const { model: m, visibleTrainIds: ids, state: s } = latest.current;
      if (halts) dispatch({ type: 'setHalts', halts });
      dispatch({ type: 'busy' });
      provider
        .full({ model: m, trainIds: ids, halts: halts ?? s.halts })
        .then((result) => {
          dispatch({ type: 'result', mode: 'full', result });
        })
        .catch(fail);
    },
    [provider],
  );

  const single = useCallback(
    (trainId: string) => {
      const { model: m, state: s } = latest.current;
      dispatch({ type: 'busy' });
      provider
        .single({ model: m, trainIds: [trainId], halts: s.halts })
        .then((result) => {
          dispatch({ type: 'single', result });
        })
        .catch(fail);
    },
    [provider],
  );

  const confirmManual = useCallback(() => {
    const { model: m, state: s } = latest.current;
    if (s.mode !== 'manual') {
      dispatch({ type: 'message', message: 'CMI: give a manual intervention (MF) first.' });
      return;
    }
    dispatch({ type: 'busy' });
    provider
      .confirmManualIntervention({ model: m, halts: s.halts, manual: s.shown })
      .then((result) => {
        dispatch({ type: 'result', mode: 'full', result });
      })
      .catch(fail);
  }, [provider]);

  const reportWrong = useCallback(
    (at: EpochMs) => {
      const { state: s } = latest.current;
      if (s.shown.size === 0) {
        dispatch({ type: 'message', message: 'WFS: no forecast is shown.' });
        return;
      }
      provider
        .reportWrongForecast({ at, forecasts: s.shown })
        .then((r) => {
          dispatch({ type: 'message', message: r.message });
        })
        .catch(fail);
    },
    [provider],
  );

  const actions = useMemo(
    () => ({
      basic,
      full,
      single,
      confirmManual,
      reportWrong,
      convertToManual: () => {
        dispatch({ type: 'convertToManual' });
      },
      reset: () => {
        dispatch({ type: 'reset' });
      },
      setOption: (option: 'manualOption' | 'haltOption', value: boolean) => {
        dispatch({ type: 'setOption', option, value });
      },
      moveManual: (trainId: string, pointIndex: number, field: 'arrival' | 'departure', time: EpochMs) => {
        dispatch({ type: 'moveManual', trainId, pointIndex, field, time });
      },
    }),
    [basic, full, single, confirmManual, reportWrong],
  );

  return { state, actions };
}
