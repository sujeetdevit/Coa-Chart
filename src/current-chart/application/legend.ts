import type { CurrentChartModel, TrainCategory } from '../domain';
import { deriveTrainMarkers } from './trainMarkers';

export interface ColourLegendEntry {
  colour: string;
  trainCount: number;
  categories: TrainCategory[];
  /** A few example train numbers/names using this colour. */
  examples: string[];
}

/**
 * Legend "L" — train colours. Line colours come from the data (COLORCODE), so the legend lists
 * the colours actually in use with the train categories and examples that use them.
 */
export function colourLegend(model: CurrentChartModel): ColourLegendEntry[] {
  const byColour = new Map<string, ColourLegendEntry>();
  for (const train of model.trains) {
    const key = train.colour.toLowerCase();
    const entry = byColour.get(key) ?? { colour: train.colour, trainCount: 0, categories: [], examples: [] };
    entry.trainCount++;
    if (!entry.categories.includes(train.category)) entry.categories.push(train.category);
    if (entry.examples.length < 3) entry.examples.push(train.number ?? train.name);
    byColour.set(key, entry);
  }
  return [...byColour.values()].sort((a, b) => b.trainCount - a.trainCount);
}

export interface HandoverEntry {
  boardId: number;
  trains: string[];
}

export interface HandoverSummary {
  takenOver: HandoverEntry[];
  handedOver: HandoverEntry[];
}

/**
 * Legend "S" — summary of trains taken over from and handed over to other boards. The manual
 * speaks of divisions; the data only identifies neighbouring boards, so the summary is by board.
 */
export function handoverSummary(model: CurrentChartModel): HandoverSummary {
  const taken = new Map<number, string[]>();
  const handed = new Map<number, string[]>();
  for (const train of model.trains) {
    const markers = deriveTrainMarkers(train, model.board.id);
    const label = train.number ?? train.name;
    const first = train.events[0];
    const last = train.events[train.events.length - 1];
    if (markers.handoverIn && first?.prevBoardId !== undefined) {
      taken.set(first.prevBoardId, [...(taken.get(first.prevBoardId) ?? []), label]);
    }
    if (markers.handoverOut && last?.nextBoardId !== undefined) {
      handed.set(last.nextBoardId, [...(handed.get(last.nextBoardId) ?? []), label]);
    }
  }
  const entries = (map: Map<number, string[]>) =>
    [...map].map(([boardId, trains]) => ({ boardId, trains })).sort((a, b) => a.boardId - b.boardId);
  return { takenOver: entries(taken), handedOver: entries(handed) };
}
