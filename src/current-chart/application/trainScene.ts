import type { ChartConfig } from '../configuration/chartConfig';
import type { CurrentChartModel, Train } from '../domain';
import type { CurrentChartEngine, DwellLanes, Rect, TrainGeometry } from '../engine';
import { crewLabelLines, isCrewOverDuty } from './crew';
import { isGpsTrain } from './gps';
import { deriveTrainMarkers, type TrainMarkers } from './trainMarkers';
import { tslSegmentIndices } from './tsl';

export interface TrainSceneItem {
  train: Train;
  actual: TrainGeometry;
  forecast: TrainGeometry;
  markers: TrainMarkers;
  /** GPS-loco enabled (highlighted by the GPS Loco checkbox). */
  gps: boolean;
  /** Crew past the duty alert: the floating label blinks. */
  crewOverDuty: boolean;
  /** Crew lines for the label when the Crew checkbox is on. */
  crewLines: string[];
  /** Actual path segments run under TSL (drawn purple dotted). */
  tslSegments: number[];
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
 * Trains to draw for the current viewport, with plot-space geometry, markers and the flags the
 * renderer needs. Trains entirely outside the visible plot (plus a margin) are dropped.
 */
export function buildTrainScene(
  engine: CurrentChartEngine,
  model: CurrentChartModel,
  lanes: DwellLanes,
  config: ChartConfig,
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
    items.push({
      train,
      actual,
      forecast,
      markers: deriveTrainMarkers(train, model.board.id),
      gps: isGpsTrain(train),
      crewOverDuty: isCrewOverDuty(train, config.crew),
      crewLines: crewLabelLines(train),
      tslSegments: tslSegmentIndices(actual.points, model.tsl, model.board),
    });
  }
  return { items, byId: new Map(items.map((item) => [item.train.id, item])) };
}
