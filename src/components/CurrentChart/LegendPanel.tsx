import { colourLegend, handoverSummary } from '../../current-chart/application/legend';
import type { ChartTheme } from '../../current-chart/configuration/chartTheme';
import type { CurrentChartModel } from '../../current-chart/domain';
import { FloatingPanel } from '../common/FloatingPanel';

const CATEGORY = { GOODS: 'Goods', PASSENGER: 'Passenger', OTHER: 'Other' } as const;

function Swatch({ colour, shape = 'line' }: { colour: string; shape?: 'line' | 'dot' | 'square' | 'dash' }) {
  return (
    <span className={`legend-swatch legend-${shape}`} style={{ '--c': colour } as React.CSSProperties} />
  );
}

/** Legends (L): train colours in use, chart icons and line occupancy (manual §11.1). */
export function LegendPanel({
  model,
  theme,
  onClose,
}: {
  model: CurrentChartModel;
  theme: ChartTheme;
  onClose: () => void;
}) {
  const m = theme.movement;
  const o = theme.overlays;
  return (
    <FloatingPanel title="Legends" onClose={onClose} className="legend-panel">
      <h4>Train colours (from the data)</h4>
      <table>
        <tbody>
          {colourLegend(model).map((e) => (
            <tr key={e.colour}>
              <td>
                <Swatch colour={e.colour} />
              </td>
              <td>{e.categories.map((c) => CATEGORY[c]).join(', ')}</td>
              <td className="muted">
                {e.trainCount} trains, e.g. {e.examples.join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Icons</h4>
      <ul className="legend-list">
        <li>
          <Swatch colour={m.floatingPoint} shape="dot" /> Last reported position (floating point)
        </li>
        <li>
          <Swatch colour={m.departedPoint} shape="dot" /> Departed from originating station
        </li>
        <li>
          <Swatch colour={m.destinationSquare} shape="square" /> Terminated
        </li>
        <li>
          <Swatch colour="#000000" shape="dash" /> Forecast
        </li>
        <li>
          <Swatch colour={m.tsl} shape="dash" /> TSL movement
        </li>
        <li>
          <Swatch colour={m.detention} shape="square" /> Detention (minutes) ·{' '}
          <Swatch colour={m.gain} shape="square" /> Gain
        </li>
        <li>
          <Swatch colour={o.blockBurst} shape="square" /> Block burst · <Swatch colour={o.blockAst} /> AST ·{' '}
          <Swatch colour={o.blockAet} /> AET
        </li>
      </ul>
      <h4>Line occupancy</h4>
      <ul className="legend-list">
        <li>
          <Swatch colour={o.occupied} shape="square" /> Occupied
        </li>
        <li>
          <Swatch colour={o.free} shape="square" /> Free
        </li>
        <li>
          <Swatch colour={o.nominated} shape="square" /> Nominated (no data)
        </li>
      </ul>
    </FloatingPanel>
  );
}

/** Legends (S): trains taken over from / handed over to neighbouring boards. */
export function SummaryPanel({ model, onClose }: { model: CurrentChartModel; onClose: () => void }) {
  const { takenOver, handedOver } = handoverSummary(model);
  const section = (title: string, entries: typeof takenOver) => (
    <>
      <h4>{title}</h4>
      {entries.length === 0 && <p className="muted">None</p>}
      <table>
        <tbody>
          {entries.map((e) => (
            <tr key={e.boardId}>
              <td>Board {e.boardId}</td>
              <td>{e.trains.length}</td>
              <td className="muted">
                {e.trains.slice(0, 12).join(', ')}
                {e.trains.length > 12 ? ' …' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
  return (
    <FloatingPanel title="Handed over / taken over" onClose={onClose} className="legend-panel">
      <p className="muted">By neighbouring board (the data identifies boards, not divisions).</p>
      {section('Taken over from', takenOver)}
      {section('Handed over to', handedOver)}
    </FloatingPanel>
  );
}
