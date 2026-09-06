import {
    periodMetadata,
    periodStaticParams,
    renderPeriodPage,
} from '@/lib/period-route';

// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

/**
 * Every valid period is now prerendered — years, months, trading days and the
 * closed days between them — so anything left is genuinely not a period we
 * hold, and can 404 at the routing layer for free.
 *
 * This closes the last unbounded cost on this route. Without it a bot walking
 * /gold-price/<anything> generates an on-demand render per URL, each an ISR
 * write, against an infinite address space. It also fixes the soft 404 those
 * probes produced: notFound() here was being prerendered and served as HTTP
 * 200 with a "Page not found" body.
 *
 * The set is fixed at build time, so a newly refreshed day is not served until
 * the deploy that carries it — which is the same deploy that adds it to the
 * data, since the refresh workflow commits and that triggers the build.
 */
export const dynamicParams = false;


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
