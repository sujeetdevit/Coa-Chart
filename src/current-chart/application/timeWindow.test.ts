import { loadSuppliedSnapshot } from '../../tests/suppliedSnapshot';
import { normalizeSnapshot, parseCoaDateTime } from '../adapters';
import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { initialTimeWindow, pannableTimeExtent } from './timeWindow';

const ist = (text: string) => parseCoaDateTime(text) ?? NaN;

describe('initialTimeWindow', () => {
  it('starts Chart Plot Hours before now, floored to the grid, and spans Chart View Hours', () => {
    expect(initialTimeWindow(ist('21-09-26 07:54:43'), DEFAULT_CHART_CONFIG)).toEqual({
      start: ist('21-09-26 05:50:00'),
      end: ist('21-09-26 08:50:00'),
    });
  });

  it('does not move the start when now is already on the grid', () => {
    const window = initialTimeWindow(ist('21-09-26 08:00:00'), DEFAULT_CHART_CONFIG);
    expect(window.start).toBe(ist('21-09-26 06:00:00'));
  });
});

describe('pannableTimeExtent with the supplied data', () => {
  const model = normalizeSnapshot(loadSuppliedSnapshot());
  const window = initialTimeWindow(model.asOf, DEFAULT_CHART_CONFIG);

  it('opens on 22:20–01:20 for the supplied data (now = 00:25)', () => {
    expect(window).toEqual({ start: ist('20-09-26 22:20:00'), end: ist('21-09-26 01:20:00') });
  });

  it('reaches back to the earliest non-stale event and forward to the window end', () => {
    expect(pannableTimeExtent(model, window, DEFAULT_CHART_CONFIG)).toEqual({
      start: ist('19-09-26 17:49:47'),
      end: window.end,
    });
  });
});
