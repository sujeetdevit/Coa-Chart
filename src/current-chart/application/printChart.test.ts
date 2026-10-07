import { smallBoard } from '../../tests/fixtures/smallModel';
import { parseCoaDateTime } from '../adapters';
import { DEFAULT_CHART_CONFIG as config } from '../configuration/chartConfig';
import { DEFAULT_CHART_THEME as theme } from '../configuration/chartTheme';
import { MS_PER_HOUR, MS_PER_MINUTE, type CurrentChartModel, type EpenMessage } from '../domain';
import { CurrentChartEngine } from '../engine';
import { buildStaticRenderModel } from '../rendering/build/buildStaticRenderModel';
import { defaultDisplayOptions } from './displayOptions';
import {
  defaultPrintOptions,
  fromIstInputValue,
  messagesToPrint,
  PRINT_STAGE,
  printDisplayOptions,
  printFileName,
  printRange,
  printTitle,
  toIstInputValue,
  type PrintOptions,
} from './printChart';

const ist = (text: string) => {
  const ms = parseCoaDateTime(text);
  if (ms === undefined) throw new Error(`bad date ${text}`);
  return ms;
};

const start = ist('20-09-26 22:20:00');
const shown = defaultDisplayOptions(config);
const options: PrintOptions = { ...defaultPrintOptions({ start, end: start + 3 * MS_PER_HOUR }, shown) };

const note = (id: string, at: number): EpenMessage => ({
  id,
  at,
  payload: 'data:image/png;base64,AAAA',
  savedAt: at,
});

describe('print chart options', () => {
  it('starts from the period and options on screen', () => {
    const visible = { start, end: start + 3 * MS_PER_HOUR };
    expect(defaultPrintOptions(visible, { ...shown, showSpeed: true })).toEqual({
      start,
      hours: 3,
      showSpeed: true,
      showGainLoss: false,
      showCrew: false,
      showMessages: true,
      controllerName: '',
    });
  });

  it('rounds the visible period to a quarter hour and keeps it within 1 to 24 hours', () => {
    const hours = (minutes: number) =>
      defaultPrintOptions({ start, end: start + minutes * MS_PER_MINUTE }, shown).hours;
    expect(hours(64)).toBe(1);
    expect(hours(100)).toBe(1.75);
    expect(hours(10)).toBe(1);
    expect(hours(40 * 60)).toBe(24);
  });

  it('gives the printed period', () => {
    expect(printRange({ start, hours: 8 })).toEqual({ start, end: ist('21-09-26 06:20:00') });
  });

  it('overrides only speed, gain/loss and crew on the display options', () => {
    const result = printDisplayOptions(
      { ...shown, highlightGps: true, showSpeed: false },
      { ...options, showSpeed: true, showGainLoss: true, showCrew: true },
    );
    expect(result).toEqual({
      ...shown,
      highlightGps: true,
      showSpeed: true,
      showGainLoss: true,
      showCrew: true,
    });
  });

  it('prints the EPEN notes inside the period, oldest first, unless switched off', () => {
    const notes = [
      note('late', start + 2 * MS_PER_HOUR),
      note('before', start - MS_PER_MINUTE),
      note('early', start + MS_PER_MINUTE),
      note('after', start + 3 * MS_PER_HOUR + MS_PER_MINUTE),
    ];
    expect(messagesToPrint(notes, options).map((n) => n.id)).toEqual(['early', 'late']);
    expect(messagesToPrint(notes, { ...options, showMessages: false })).toEqual([]);
  });

  it('titles the page with the board and the period in IST', () => {
    expect(printTitle(3, options)).toBe('Board 3 · 20-09-2026 22:20 to 21-09-2026 01:20 IST');
    expect(printTitle(undefined, options)).toContain('Board —');
  });

  it('names the saved image after the board and shift start', () => {
    expect(printFileName(3, options)).toBe('current-chart-board-3-20260920-2220.png');
  });

  it('converts between epoch time and the IST value of a date-time input', () => {
    expect(toIstInputValue(start)).toBe('2026-09-20T22:20');
    expect(fromIstInputValue('2026-09-20T22:20')).toBe(start);
    expect(fromIstInputValue('2026-09-20T22:20:30')).toBe(start);
    expect(fromIstInputValue('')).toBeUndefined();
    expect(fromIstInputValue('20-09-2026')).toBeUndefined();
  });
});

describe('buildStaticRenderModel', () => {
  const model: CurrentChartModel = {
    board: smallBoard(),
    trains: [],
    blocks: [],
    cautions: [],
    trainRemarks: [],
    chartRemarks: [],
    unusualOccurrences: [],
    tsl: [],
    gpsLocoMovements: [],
    epenMessages: [],
    asOf: start + MS_PER_HOUR,
    diagnostics: [],
  };

  it('draws the print page at its own size and period, with no interaction layer', () => {
    const window = printRange(options);
    const engine = CurrentChartEngine.create({
      board: model.board,
      stage: PRINT_STAGE,
      margins: theme.margins,
      window,
      timeExtent: window,
      now: model.asOf,
      config,
    });
    const image = buildStaticRenderModel({ engine, model, lanes: new Map(), config, theme, options: shown });

    expect(image.width).toBe(PRINT_STAGE.width);
    expect(image.height).toBe(PRINT_STAGE.height);
    expect(engine.getVisibleTimeRange()).toEqual(window);
    expect(image.layers.interaction).toEqual([]);
    expect(image.layers.infrastructure.map((g) => g.id)).not.toContain('column-splitters');
    expect(image.layers.infrastructure.map((g) => g.id)).toContain('panels');
    expect(image.layers.background.length).toBeGreaterThan(0);
    expect(image.layers.axes.length).toBeGreaterThan(0);
  });
});
