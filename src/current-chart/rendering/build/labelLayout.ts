/** A label to place near an anchor point (plot or stage pixels). */
export interface LabelRequest {
  id: string;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export interface PlacedLabel extends LabelRequest {
  /** Top-left corner of the label box. */
  x: number;
  y: number;
  /** True when moved off its preferred position (a leader line should connect it). */
  displaced: boolean;
}

const GAP = 3;
const MAX_TRIES = 7;

function overlaps(a: { x: number; y: number; width: number; height: number }, b: PlacedLabel): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Greedy de-clutter: each label prefers the spot just above-right of its anchor; when that
 * overlaps an already placed label it tries alternately above and below in label-height steps
 * (the legacy chart stacked labels the same way). Labels that can't be freed keep their spot.
 */
export function layoutLabels(requests: LabelRequest[]): PlacedLabel[] {
  const ordered = [...requests].sort((a, b) => a.anchorX - b.anchorX || a.anchorY - b.anchorY);
  const placed: PlacedLabel[] = [];
  for (const r of ordered) {
    const baseX = r.anchorX + GAP;
    const baseY = r.anchorY - r.height - GAP;
    let chosen: PlacedLabel = { ...r, x: baseX, y: baseY, displaced: false };
    for (let i = 0; i < MAX_TRIES; i++) {
      // 0, -1, +1, -2, +2, … label heights
      const step = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 === 1 ? -1 : 1);
      const candidate = { x: baseX, y: baseY + step * (r.height + GAP), width: r.width, height: r.height };
      if (!placed.some((p) => overlaps(candidate, p))) {
        chosen = { ...r, ...candidate, displaced: step !== 0 };
        break;
      }
    }
    placed.push(chosen);
  }
  return placed;
}
