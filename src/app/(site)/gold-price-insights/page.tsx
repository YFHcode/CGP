import { insightsMetadata, renderInsightsPage } from '@/lib/insights-route';

// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

export const metadata = insightsMetadata('XAU');

export default async function GoldPriceInsightsPage() {
    return renderInsightsPage('XAU');
}
