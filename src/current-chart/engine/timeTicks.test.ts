import { parseCoaDateTime } from '../adapters';
import { timeTicks } from './timeTicks';

const ist = (text: string) => parseCoaDateTime(text) ?? NaN;
const spacing = { minLinePx: 5, minLabelPx: 26 };

describe('timeTicks', () => {
  it('ticks every 10 minutes on IST boundaries, hours labelled with the hour', () => {
    const ticks = timeTicks(
      { start: ist('21-09-26 05:47:00'), end: ist('21-09-26 06:25:00') },
      7,
      10,
      spacing,
    );
    expect(ticks.map((t) => [t.label, t.isHour, t.labelled])).toEqual([
      ['50', false, true],
      ['6', true, true],
      ['10', false, true],
      ['20', false, true],
    ]);
    expect(ticks[0]?.time).toBe(ist('21-09-26 05:50:00'));
  });

  it('includes a tick exactly at the range start', () => {
    const ticks = timeTicks(
      { start: ist('21-09-26 06:00:00'), end: ist('21-09-26 06:10:00') },
      7,
      10,
      spacing,
    );
    expect(ticks.map((t) => t.label)).toEqual(['6', '10']);
  });

  it('labels the IST hour across midnight', () => {
    const ticks = timeTicks(
      { start: ist('20-09-26 23:55:00'), end: ist('21-09-26 00:05:00') },
      7,
      10,
      spacing,
    );
    expect(ticks.map((t) => [t.label, t.isHour])).toEqual([['0', true]]);
  });

  it('thins labels before lines when zoomed out', () => {
    // 1 px/min: 10-min lines are 10 px apart (ok), labels need 26 px → every 30 min.
    const ticks = timeTicks(
      { start: ist('21-09-26 06:00:00'), end: ist('21-09-26 07:00:00') },
      1,
      10,
      spacing,
    );
    expect(ticks).toHaveLength(7);
    expect(ticks.filter((t) => t.labelled).map((t) => t.label)).toEqual(['6', '30', '7']);
  });

  it('thins lines too when very zoomed out', () => {
    // 0.1 px/min: lines need 50-min steps → 60; labels need 260 → 360 (6 h).
    const ticks = timeTicks(
      { start: ist('21-09-26 00:00:00'), end: ist('21-09-26 12:00:00') },
      0.1,
      10,
      spacing,
    );
    expect(ticks.map((t) => t.label)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
    expect(ticks.filter((t) => t.labelled).map((t) => t.label)).toEqual(['0', '6', '12']);
  });
});
