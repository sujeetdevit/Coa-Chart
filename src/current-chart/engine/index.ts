export {
  CurrentChartEngine,
  type ChartBounds,
  type ChartEngineOptions,
  type PlacedStation,
  type TrainGeometry,
  type TrainPathPoint,
} from './CurrentChartEngine';
export { computeDwellLanes, dwellLaneKey, type DwellLanes } from './dwellLanes';
export { TrainHitIndex, distanceToSegment, type HitTarget, type HitTolerance } from './hitIndex';
export { buildStationLayout, type StationLayout, type StationPosition } from './stationLayout';
export { timeTicks, type TickSpacing, type TimeTick } from './timeTicks';
export {
  actualPathVertices,
  forecastPathVertices,
  type PathPointKind,
  type TrainPathVertex,
} from './trainGeometry';
export type { Viewport } from './viewport';
export type { Margins, Point, Rect, Size } from './types';
