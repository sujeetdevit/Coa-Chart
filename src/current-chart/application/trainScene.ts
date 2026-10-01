import type { CurrentChartModel, Train } from '../domain';
import type { CurrentChartEngine, DwellLanes, Rect, TrainGeometry } from '../engine';
import { deriveTrainMarkers, type TrainMarkers } from './trainMarkers';

export interface TrainSceneItem {
  train: Train;
  actual: TrainGeometry;
  forecast: TrainGeometry;
  markers: TrainMarkers;
}

export interface TrainScene {
  items: TrainSceneItem[];
  byId: ReadonlyMap<string, TrainSceneItem>;
}

/** Extra room around the plot so labels of trains just outside the edge still show. */
const CULL_MARGIN_PX = 120;

function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/**
 * Trains to draw for the current viewport, with plot-space geometry and their markers.
 * Trains entirely outside the visible plot (plus a margin) are dropped.
 */
export function buildTrainScene(
  engine: CurrentChartEngine,
  model: CurrentChartModel,
  lanes: DwellLanes,
  isVisible: (train: Train) => boolean = () => true,
): TrainScene {
  const { plot } = engine.getChartBounds();
  const view: Rect = {
    x: -CULL_MARGIN_PX,
    y: -CULL_MARGIN_PX,
    width: plot.width + 2 * CULL_MARGIN_PX,
    height: plot.height + 2 * CULL_MARGIN_PX,
  };

  const items: TrainSceneItem[] = [];
  for (const train of model.trains) {
    if (!isVisible(train)) continue;
    const actual = engine.getTrainGeometry(train, lanes);
    const forecast = engine.getForecastGeometry(train, lanes);
    const onScreen =
      (actual.bounds && intersects(actual.bounds, view)) ||
      (forecast.bounds && intersects(forecast.bounds, view));
    if (!onScreen) continue;
    items.push({ train, actual, forecast, markers: deriveTrainMarkers(train, model.board.id) });
  }
  return { items, byId: new Map(items.map((item) => [item.train.id, item])) };
}
