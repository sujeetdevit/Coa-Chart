import type { EpochMs, TrainForecast } from '../../domain';
import type { ForecastResult, ForecastSource, ManualHalt } from './ForecastProvider';
import { moveForecastTime, toManual } from './manualForecast';

export type ForecastMode = 'none' | 'basic' | 'full' | 'manual';

/** State behind the manual's forecast bar: Manual, Halt Data, WFS, MF, BF, FF, CMI, Reset. */
export interface ForecastWorkflowState {
  mode: ForecastMode;
  /** Forecasts currently shown (basic, full, single additions or manual edits). */
  shown: ReadonlyMap<string, TrainForecast>;
  /** "Manual" checkbox: required before MF. */
  manualOption: boolean;
  /** "Halt Data" checkbox: FF opens the Train Manual Halt form first. */
  haltOption: boolean;
  halts: ManualHalt[];
  busy: boolean;
  source?: ForecastSource;
  message?: string;
}

export type ForecastWorkflowAction =
  | { type: 'busy' }
  | { type: 'result'; mode: 'basic' | 'full'; result: ForecastResult }
  | { type: 'single'; result: ForecastResult }
  | { type: 'convertToManual' }
  | { type: 'moveManual'; trainId: string; pointIndex: number; field: 'arrival' | 'departure'; time: EpochMs }
  | { type: 'setOption'; option: 'manualOption' | 'haltOption'; value: boolean }
  | { type: 'setHalts'; halts: ManualHalt[] }
  | { type: 'message'; message: string }
  | { type: 'reset' };

export const INITIAL_FORECAST_STATE: ForecastWorkflowState = {
  mode: 'none',
  shown: new Map(),
  manualOption: false,
  haltOption: false,
  halts: [],
  busy: false,
};

function withResultMessage(state: ForecastWorkflowState, result: ForecastResult): ForecastWorkflowState {
  const next: ForecastWorkflowState = { ...state, busy: false, source: result.source };
  if (result.message !== undefined) next.message = result.message;
  else delete next.message;
  return next;
}

export function forecastWorkflowReducer(
  state: ForecastWorkflowState,
  action: ForecastWorkflowAction,
): ForecastWorkflowState {
  switch (action.type) {
    case 'busy':
      return { ...state, busy: true };
    case 'result':
      return {
        ...withResultMessage(state, action.result),
        mode: action.mode,
        shown: action.result.forecasts,
      };
    case 'single': {
      // Adds one train's forecast to whatever is shown.
      const shown = new Map(state.shown);
      for (const [id, f] of action.result.forecasts) shown.set(id, f);
      return {
        ...withResultMessage(state, action.result),
        mode: state.mode === 'none' ? 'basic' : state.mode,
        shown,
      };
    }
    case 'convertToManual':
      if (!state.manualOption) return { ...state, message: 'Select the Manual option before MF.' };
      if (state.shown.size === 0) return { ...state, message: 'No forecast to convert. Run FF first.' };
      return {
        ...state,
        mode: 'manual',
        shown: toManual(state.shown),
        message: 'Manual forecast: drag a forecast point to change its time. Not saved.',
      };
    case 'moveManual': {
      const forecast = state.shown.get(action.trainId);
      if (state.mode !== 'manual' || !forecast) return state;
      const shown = new Map(state.shown);
      shown.set(action.trainId, moveForecastTime(forecast, action.pointIndex, action.field, action.time));
      return { ...state, shown };
    }
    case 'setOption':
      return { ...state, [action.option]: action.value };
    case 'setHalts':
      return { ...state, halts: action.halts };
    case 'message':
      return { ...state, busy: false, message: action.message };
    case 'reset':
      return {
        ...INITIAL_FORECAST_STATE,
        manualOption: state.manualOption,
        haltOption: state.haltOption,
        halts: state.halts,
      };
  }
}
