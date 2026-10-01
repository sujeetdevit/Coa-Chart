import type { Direction, Train, TrainCategory } from '../domain';

/**
 * Manual §11.1 toolbar filters. Goods / Pass / Others are checkboxes ("view only …"): when
 * any are ticked, trains of the ticked categories are shown; when none are, all are.
 * All / UP / DN shows trains by direction.
 */
export interface TrainFilters {
  categories: Record<TrainCategory, boolean>;
  direction: 'ALL' | Direction;
}

export const NO_FILTERS: TrainFilters = {
  categories: { GOODS: false, PASSENGER: false, OTHER: false },
  direction: 'ALL',
};

/** A train's current direction: that of its latest event with a direction. */
export function trainDirection(train: Train): Direction | undefined {
  for (let i = train.events.length - 1; i >= 0; i--) {
    const direction = train.events[i]?.direction;
    if (direction) return direction;
  }
  return undefined;
}

export function isTrainVisible(train: Train, filters: TrainFilters): boolean {
  const anyCategory = Object.values(filters.categories).some(Boolean);
  if (anyCategory && !filters.categories[train.category]) return false;
  if (filters.direction !== 'ALL' && trainDirection(train) !== filters.direction) return false;
  return true;
}
