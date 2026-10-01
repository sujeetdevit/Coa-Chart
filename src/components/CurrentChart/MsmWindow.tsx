import { useEffect, useMemo, useState } from 'react';
import {
  nearestSample,
  type MsmProvider,
  type MsmRequest,
  type MsmResult,
} from '../../current-chart/application/msm';
import { formatIstTime, trainTitle } from '../../current-chart/application/trainDescriptions';
import type { ChartTheme } from '../../current-chart/configuration/chartTheme';
import type { MidSectionSample } from '../../current-chart/domain';
import { buildMsmRenderModel } from '../../current-chart/rendering/build/buildMsmRenderModel';
import type { ChartGesture } from '../../current-chart/rendering/types';
import { FloatingPanel } from '../common/FloatingPanel';
import { ChartCanvas } from './ChartCanvas';

const SIZE = { width: 440, height: 220 };

interface MsmWindowProps {
  request: MsmRequest;
  provider: MsmProvider;
  theme: ChartTheme;
  onClose: () => void;
}

/** Manual §11.1 MSM: mid-block-section plot of a traversed block section, with speed/time. */
export function MsmWindow({ request, provider, theme, onClose }: MsmWindowProps) {
  const [result, setResult] = useState<MsmResult>();
  const [focus, setFocus] = useState<MidSectionSample>();

  useEffect(() => {
    let cancelled = false;
    void provider.midSection(request).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [provider, request]);

  const plot = useMemo(
    () =>
      result && result.samples.length > 1
        ? buildMsmRenderModel(result.samples, SIZE, theme, request.train.colour, (t) => formatIstTime(t))
        : undefined,
    [result, theme, request.train.colour],
  );

  const onGesture = (g: ChartGesture) => {
    if (g.type === 'pointerMove' && plot && result)
      setFocus(nearestSample(result.samples, plot.xToTime(g.x)));
    if (g.type === 'pointerLeave') setFocus(undefined);
  };

  const title = `${request.from.code}–${request.to.code} · ${trainTitle(request.train)}`;
  return (
    <FloatingPanel title={title} onClose={onClose} className="msm-window">
      {!result && <p>Loading mid-section data…</p>}
      {result?.message && (
        <p className="muted">
          {result.source === 'sample' && <span className="badge">Sample data</span>} {result.message}
        </p>
      )}
      {plot && result && (
        <div className="msm-body">
          <div className="msm-plot" style={SIZE}>
            <ChartCanvas renderModel={plot.model} onGesture={onGesture} />
            {focus && (
              <div className="msm-readout">
                {formatIstTime(focus.at, true)} · {focus.speedKmph} km/h · {focus.distanceKm} km
              </div>
            )}
          </div>
          <table className="msm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Speed</th>
              </tr>
            </thead>
            <tbody>
              {result.samples.map((s) => (
                <tr key={s.at} className={s === focus ? 'focus' : ''}>
                  <td>{formatIstTime(s.at, true)}</td>
                  <td>{s.speedKmph}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </FloatingPanel>
  );
}
