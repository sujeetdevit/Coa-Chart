import type { EpenStore } from '../../current-chart/application/epen';
import type { ForecastProvider } from '../../current-chart/application/forecast/ForecastProvider';
import type { MsmProvider } from '../../current-chart/application/msm';

/** External services the chart talks to; swapped for server-backed ones when APIs exist. */
export interface ChartServices {
  forecast: ForecastProvider;
  msm: MsmProvider;
  epen: EpenStore;
}
