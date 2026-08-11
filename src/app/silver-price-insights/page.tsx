import { insightsMetadata, renderInsightsPage } from '@/lib/insights-route';

export const revalidate = 86400;

export const metadata = insightsMetadata('XAG');

export default async function SilverPriceInsightsPage() {
    return renderInsightsPage('XAG');
}
