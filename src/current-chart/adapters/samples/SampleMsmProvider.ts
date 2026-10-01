import type { MsmProvider, MsmRequest, MsmResult } from '../../application/msm';
import type { MidSectionSample } from '../../domain';

const STEP_MS = 30_000;
/** Used when the board's reference distances are missing or implausible for the section. */
const FALLBACK_KM = 6;

/**
 * SAMPLE mid-section data for UI development only — not GPS data. Produces a smooth
 * accelerate–run–brake profile between the reported departure and arrival, every 30 seconds,
 * over the distance between the two stations' reference km.
 */
export class SampleMsmProvider implements MsmProvider {
  midSection(request: MsmRequest): Promise<MsmResult> {
    const raw = Math.abs(request.to.kmFromReference - request.from.kmFromReference);
    const distanceKm = raw > 0 && raw < 30 ? raw : FALLBACK_KM;
    const duration = request.arrival - request.departure;
    const samples: MidSectionSample[] = [];
    for (let t = 0; t <= duration; t += STEP_MS)
      samples.push(sampleAt(t / duration, distanceKm, duration, request));
    if (samples[samples.length - 1]?.at !== request.arrival)
      samples.push(sampleAt(1, distanceKm, duration, request));
    return Promise.resolve({
      samples,
      source: 'sample',
      message: 'Sample mid-section data — no GPS/RTIS positions were supplied.',
    });
  }
}

/** Smoothstep distance curve: speed rises from 0, peaks mid-section, falls to 0. */
function sampleAt(u: number, distanceKm: number, durationMs: number, request: MsmRequest): MidSectionSample {
  const distance = distanceKm * (3 * u * u - 2 * u * u * u);
  const speedKmPerMs = (distanceKm * (6 * u - 6 * u * u)) / durationMs;
  return {
    at: request.departure + u * durationMs,
    distanceKm: Math.round(distance * 100) / 100,
    speedKmph: Math.round(speedKmPerMs * 3_600_000),
  };
}
