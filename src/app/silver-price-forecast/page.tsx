import { ForecastPage, forecastMetadata } from '@/lib/forecast-route';

// Route segment config must be a direct export of the route file.
export const revalidate = 10800;

export const generateMetadata = () => forecastMetadata('XAG');

export default function SilverForecastPage() {
    return <ForecastPage metal="XAG" />;
}
