import { ForecastPage, forecastMetadata } from '@/lib/forecast-route';

// Route segment config must be a direct export of the route file.
// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

export const generateMetadata = () => forecastMetadata('XAG');

export default function SilverForecastPage() {
    return <ForecastPage metal="XAG" />;
}
