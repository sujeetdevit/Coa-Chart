import type { EpenStore } from '../../current-chart/application/epen';
import type { ForecastProvider } from '../../current-chart/application/forecast/ForecastProvider';
import type { MsmProvider } from '../../current-chart/application/msm';

/** External services the chart talks to; swapped for server-backed ones when APIs exist. */
export interface ChartServices {
  forecast: ForecastProvider;
  msm: MsmProvider;
  epen: EpenStore;
}

/** Data refresh status and controls shown in the chart header. */
export interface ChartRefreshControls {
  /** When the data shown was last confirmed with the source (clock time, ms). */
  loadedAt: number;
  refreshing: boolean;
  /** Why the latest refresh failed, while the previous data is still shown. */
  error?: string;
  auto: boolean;
  intervalSeconds: number;
  onAutoChange: (auto: boolean) => void;
  onRefresh: () => void;
}
