import { DEFAULT_CHART_CONFIG } from '../configuration/chartConfig';
import { DEFAULT_CHART_THEME, withColumnWidths } from '../configuration/chartTheme';
import { ALL_SIDE_COLUMNS, defaultDisplayOptions, sideColumnWidths } from './displayOptions';

const { layout } = DEFAULT_CHART_THEME;
const full = {
  caution: layout.cautionColumn,
  occupancy: layout.occupancyColumn,
  unusual: layout.unusualColumn,
};

describe('side column options', () => {
  it('shows every side column by default', () => {
    const options = defaultDisplayOptions(DEFAULT_CHART_CONFIG);
    expect(options).toMatchObject(ALL_SIDE_COLUMNS);
    expect(ALL_SIDE_COLUMNS).toEqual({
      showCautionColumn: true,
      showLineColumn: true,
      showUnusualColumn: true,
    });
    expect(sideColumnWidths(options, layout)).toEqual(full);
  });

  it('gives a switched-off column no width, each independently', () => {
    expect(sideColumnWidths({ ...ALL_SIDE_COLUMNS, showCautionColumn: false }, layout)).toEqual({
      ...full,
      caution: 0,
    });
    expect(sideColumnWidths({ ...ALL_SIDE_COLUMNS, showLineColumn: false }, layout)).toEqual({
      ...full,
      occupancy: 0,
    });
    expect(sideColumnWidths({ ...ALL_SIDE_COLUMNS, showUnusualColumn: false }, layout)).toEqual({
      ...full,
      unusual: 0,
    });
  });

  it('hands the freed width to the plot through the right margin', () => {
    const all = withColumnWidths(DEFAULT_CHART_THEME, sideColumnWidths(ALL_SIDE_COLUMNS, layout));
    const none = withColumnWidths(
      DEFAULT_CHART_THEME,
      sideColumnWidths({ showCautionColumn: false, showLineColumn: false, showUnusualColumn: false }, layout),
    );
    expect(all.margins).toEqual(DEFAULT_CHART_THEME.margins);
    expect(all.margins.right - none.margins.right).toBe(
      layout.cautionColumn + layout.occupancyColumn + layout.unusualColumn,
    );
    // Only the station names and distances stay on the right.
    expect(none.margins.right).toBe(layout.stationColumn);
    expect(none.margins.left).toBe(DEFAULT_CHART_THEME.margins.left);
  });

  it('keeps the unusual column when its width is not given', () => {
    const theme = withColumnWidths(DEFAULT_CHART_THEME, { caution: 0, occupancy: 0 });
    expect(theme.layout.unusualColumn).toBe(layout.unusualColumn);
  });
});
