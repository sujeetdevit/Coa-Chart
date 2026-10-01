import {
  crewLines,
  formatIstTime,
  lateStatus,
  locoLines,
  trainTitle,
} from '../../current-chart/application/trainDescriptions';
import type { Train } from '../../current-chart/domain';

const CATEGORY = { GOODS: 'Goods', PASSENGER: 'Passenger', OTHER: 'Other' } as const;

/** Details of the selected train, top-left of the chart. */
export function TrainDetailsPanel({ train, onClose }: { train: Train; onClose: () => void }) {
  const lastReported = [...train.events].reverse().find((e) => e.isLastReported);
  const lastTime = lastReported?.departure ?? lastReported?.arrival;
  const status = lateStatus(train);
  const locos = locoLines(train);
  const crew = crewLines(train);

  return (
    <aside className="train-panel" aria-label="Selected train">
      <header>
        <span className="train-panel-swatch" style={{ background: train.colour }} />
        <strong>{trainTitle(train)}</strong>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <dl>
        <dt>Type</dt>
        <dd>{CATEGORY[train.category]}</dd>
        {lastReported && lastTime !== undefined && (
          <>
            <dt>Last report</dt>
            <dd>
              {lastReported.departure !== undefined ? 'Dep' : 'Arr'} {lastReported.stationCode}{' '}
              {formatIstTime(lastTime, true)}
            </dd>
          </>
        )}
        {status && (
          <>
            <dt>Status</dt>
            <dd>{status}</dd>
          </>
        )}
        <dt>Loco</dt>
        <dd>{locos.length > 0 ? locos.join(', ') : '—'}</dd>
        <dt>Crew</dt>
        <dd>{crew.length > 0 ? crew.map((c) => <div key={c}>{c}</div>) : '—'}</dd>
      </dl>
    </aside>
  );
}
