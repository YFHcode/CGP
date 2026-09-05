import {
    periodMetadata,
    periodStaticParams,
    renderPeriodPage,
} from '@/lib/period-route';

// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

export function generateStaticParams() {
    return periodStaticParams('XAU');
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }) {
    const { period } = await params;
    return periodMetadata('XAU', period);
}

export default async function GoldPeriodPage({ params }: { params: Promise<{ period: string }> }) {
    const { period } = await params;
    return renderPeriodPage('XAU', period);
}
