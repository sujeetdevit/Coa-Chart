import type { CrewDisplayConfig } from '../configuration/chartConfig';
import type { EpochMs, Train } from '../domain';

/**
 * Manual §11.1 / §5.1.7: a train whose crew has completed 07 hours (configurable) of duty gets a
 * blinking floating label. Uses the source's minutes-on-duty for crew not yet signed off
 * (legacy behaviour: COD with no sign-off time).
 */
export function isCrewOverDuty(train: Train, config: CrewDisplayConfig): boolean {
  const limit = config.dutyAlertHours * 60;
  return train.crew.some((c) => c.signOff === undefined && c.minutesOnDuty >= limit);
}

/** Crew lines for the train label when the Crew checkbox is on: "DR MOHIT". */
export function crewLabelLines(train: Train): string[] {
  const onDuty = train.crew.filter((c) => c.signOff === undefined);
  return (onDuty.length > 0 ? onDuty : train.crew).map((c) => `${c.type} ${c.name}`);
}

/**
 * Blink phase at a moment in time: during the first `blinkDurationSeconds` of every
 * `blinkIntervalSeconds`, the label alternates on/off every `blinkToggleMs`. Returns true while
 * the label should be dimmed.
 */
export function isBlinkOff(at: EpochMs, config: CrewDisplayConfig): boolean {
  const intervalMs = config.blinkIntervalSeconds * 1000;
  const t = ((at % intervalMs) + intervalMs) % intervalMs;
  if (t >= config.blinkDurationSeconds * 1000) return false;
  return Math.floor(t / config.blinkToggleMs) % 2 === 1;
}
