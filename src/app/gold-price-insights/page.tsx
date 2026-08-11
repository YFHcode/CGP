import { insightsMetadata, renderInsightsPage } from '@/lib/insights-route';

export const revalidate = 86400;

export const metadata = insightsMetadata('XAU');

export default async function GoldPriceInsightsPage() {
    return renderInsightsPage('XAU');
}
