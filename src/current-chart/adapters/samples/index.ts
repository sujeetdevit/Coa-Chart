import sampleForecastUrl from '../../../data/forecast.sample.json?url';
import { SampleForecastProvider } from './SampleForecastProvider';

export { SampleForecastProvider, parseSample } from './SampleForecastProvider';
export { SampleMsmProvider } from './SampleMsmProvider';

/** Sample forecast provider over the generated sample file (UI development only). */
export function createSampleForecastProvider(): SampleForecastProvider {
  return new SampleForecastProvider(async () => {
    const response = await fetch(sampleForecastUrl);
    if (!response.ok) throw new Error(`Sample forecast: HTTP ${response.status}`);
    return (await response.json()) as unknown;
  });
}
