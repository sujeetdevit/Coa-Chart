import { useState } from 'react';
import type { ManualHalt } from '../../current-chart/application/forecast/ForecastProvider';
import { trainTitle } from '../../current-chart/application/trainDescriptions';
import type { Board, Train } from '../../current-chart/domain';
import { FloatingPanel } from '../common/FloatingPanel';

interface HaltRow {
  trainId: string;
  kind: 'station' | 'blockSection';
  /** Station id, or the "from" station id for a block section. */
  stationId: string;
  minutes: number;
}

interface HaltDialogProps {
  trains: Train[];
  board: Board;
  halts: ManualHalt[];
  onRun: (halts: ManualHalt[]) => void;
  onClose: () => void;
}

/**
 * Train Manual Halt form (manual §11.1.2): "Halt on Station" and "Delay in Block section",
 * sent with the full forecast request.
 */
export function HaltDialog({ trains, board, halts, onRun, onClose }: HaltDialogProps) {
  const stations = board.stations;
  const [rows, setRows] = useState<HaltRow[]>(() =>
    halts.map((h) => ({
      trainId: h.trainId,
      kind: h.location.kind,
      stationId: `${h.location.sectionId}:${h.location.kind === 'station' ? h.location.stationCode : h.location.fromStationCode}`,
      minutes: h.minutes,
    })),
  );

  const update = (i: number, patch: Partial<HaltRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const toHalts = (): ManualHalt[] =>
    rows.flatMap((r): ManualHalt[] => {
      const index = stations.findIndex((s) => s.id === r.stationId);
      const station = stations[index];
      if (!station || r.minutes <= 0) return [];
      if (r.kind === 'station') {
        return [
          {
            trainId: r.trainId,
            minutes: r.minutes,
            location: { kind: 'station', sectionId: station.sectionId, stationCode: station.code },
          },
        ];
      }
      const next = stations[index + 1];
      if (!next || next.sectionId !== station.sectionId) return [];
      return [
        {
          trainId: r.trainId,
          minutes: r.minutes,
          location: {
            kind: 'blockSection',
            sectionId: station.sectionId,
            fromStationCode: station.code,
            toStationCode: next.code,
          },
        },
      ];
    });

  return (
    <FloatingPanel title="Train Manual Halt" onClose={onClose} className="halt-dialog">
      <table className="form-table">
        <thead>
          <tr>
            <th>Train</th>
            <th>Type</th>
            <th>Station / block section from</th>
            <th>Minutes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <select
                  value={r.trainId}
                  onChange={(e) => {
                    update(i, { trainId: e.target.value });
                  }}
                >
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {trainTitle(t)}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={r.kind}
                  onChange={(e) => {
                    update(i, { kind: e.target.value as HaltRow['kind'] });
                  }}
                >
                  <option value="station">Halt on station</option>
                  <option value="blockSection">Delay in block section</option>
                </select>
              </td>
              <td>
                <select
                  value={r.stationId}
                  onChange={(e) => {
                    update(i, { stationId: e.target.value });
                  }}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={r.minutes}
                  onChange={(e) => {
                    update(i, { minutes: Number(e.target.value) });
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => {
                    setRows((prev) => prev.filter((_, j) => j !== i));
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-actions">
        <button
          type="button"
          disabled={trains.length === 0 || stations.length === 0}
          onClick={() => {
            const first = trains[0];
            const station = stations[0];
            if (first && station)
              setRows((prev) => [
                ...prev,
                { trainId: first.id, kind: 'station', stationId: station.id, minutes: 5 },
              ]);
          }}
        >
          Add row
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => {
            onRun(toHalts());
            onClose();
          }}
        >
          Run FF
        </button>
      </div>
    </FloatingPanel>
  );
}
