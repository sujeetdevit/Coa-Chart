import { useEffect, useState } from 'react';
import { isBlinkOff } from '../current-chart/application/crew';
import type { CrewDisplayConfig } from '../current-chart/configuration/chartConfig';

/**
 * Wall-clock blink phase for crew-duty labels. Ticks only while `active`, and only changes state
 * on phase flips, so outside the 20-second blink window nothing re-renders.
 */
export function useBlinkPhase(active: boolean, config: CrewDisplayConfig): boolean {
  const [off, setOff] = useState(false);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      setOff(isBlinkOff(Date.now(), config));
    };
    const timer = setInterval(tick, config.blinkToggleMs);
    return () => {
      clearInterval(timer);
    };
  }, [active, config]);

  return active && off;
}
