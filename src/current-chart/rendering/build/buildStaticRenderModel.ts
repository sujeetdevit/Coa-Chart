import type { ChartDisplayOptions } from '../../application/displayOptions';
import { buildOverlayScene } from '../../application/overlayScene';
import { buildTrainScene } from '../../application/trainScene';
import type { ChartConfig } from '../../configuration/chartConfig';
import type { ChartTheme } from '../../configuration/chartTheme';
import type { CurrentChartModel, Train } from '../../domain';
import type { CurrentChartEngine, DwellLanes } from '../../engine';
import type { ChartRenderModel } from '../types';
import { buildBaseRenderModel } from './buildBaseRenderModel';
import { buildAnnotationGroups, buildInfrastructureLayer, SPLITTER_GROUP } from './buildInfrastructureLayer';
import { buildMovementLayer } from './buildMovementLayer';
import { composeRenderModel } from './composeRenderModel';

export interface StaticChartInput {
  /** Sized and positioned for the picture wanted (e.g. a print page and the shift to print). */
  engine: CurrentChartEngine;
  model: CurrentChartModel;
  lanes: DwellLanes;
  config: ChartConfig;
  theme: ChartTheme;
  options: ChartDisplayOptions;
  isVisible?: (train: Train) => boolean;
}

/**
 * The whole chart as one render model, for a picture rather than the live view: no hover or
 * selection, no drag handles, and blinking labels drawn in their "on" state.
 */
export function buildStaticRenderModel(input: StaticChartInput): ChartRenderModel {
  const { engine, model, lanes, config, theme, options } = input;
  const scene = buildTrainScene(engine, model, lanes, config, input.isVisible);
  const overlays = buildOverlayScene(engine, model, theme, model.asOf);
  return composeRenderModel(buildBaseRenderModel(engine, theme), {
    // Drag handles are for the screen only.
    infrastructure: buildInfrastructureLayer(overlays, engine, theme).filter((g) => g.id !== SPLITTER_GROUP),
    movement: [
      ...buildMovementLayer(scene, engine, options, config, theme, false),
      ...buildAnnotationGroups(overlays, engine, theme),
    ],
    interaction: [],
  });
}
