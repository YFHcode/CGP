import { notFound } from 'next/navigation';

import { LazyPriceChart } from '@/components/LazyPriceChart';
import { AnalysisSection } from '@/components/AnalysisSection';
import { LastUpdated } from '@/components/LastUpdated';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices, getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { formatMetalPrice } from '@/lib/currencies';

const CHARTS = {
    gold: {
        name: 'Gold',
        symbol: 'XAU' as const,
        title: 'Gold Price Chart — XAU/USD Live',
        description:
            'Interactive gold price chart with daily closes over one week to one year, plus the day range and gold-to-silver ratio.',
    },
    silver: {
        name: 'Silver',
        symbol: 'XAG' as const,
        title: 'Silver Price Chart — XAG/USD Live',
        description:
            'Interactive silver price chart with daily closes over one week to one year, plus the day range and gold-to-silver ratio.',
    },
};

type ChartSlug = keyof typeof CHARTS;

function isChartSlug(value: string): value is ChartSlug {
    return value in CHARTS;
}

/** Prerender both charts instead of rendering them on demand. */
export function generateStaticParams() {
    return Object.keys(CHARTS).map((symbol) => ({ symbol }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;
    const slug = symbol.toLowerCase();

    if (!isChartSlug(slug)) {
        return pageMetadata({
            title: 'Chart not found',
            description: 'The requested price chart does not exist.',
            path: `/charts/${slug}`,
            noIndex: true,
        });
    }

    const chart = CHARTS[slug];
    return pageMetadata({
        title: chart.title,
        description: chart.description,
        path: `/charts/${slug}`,
        keywords: [`${chart.name.toLowerCase()} chart`, `${chart.symbol} USD`, `${chart.name.toLowerCase()} price chart`],
    });
}

export default async function ChartPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;
    const slug = symbol.toLowerCase();

    if (!isChartSlug(slug)) notFound();

    const chart = CHARTS[slug];
    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);
    const data = slug === 'gold' ? gold : silver;

    return (
        <>
            <JsonLd
                schema={breadcrumbSchema([
                    { name: `${chart.name} chart`, path: `/charts/${slug}` },
                ])}
            />

            <Breadcrumbs
                trail={[{ name: `${chart.name} chart`, href: `/charts/${slug}` }]}
            />

            <section className="bg-zinc-900/50 py-12">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="mb-4 text-4xl font-bold text-white">{chart.title}</h1>
                    {data && (
                        <p className="text-2xl font-medium text-gold-300">
                            {formatMetalPrice(data.price, 'USD')}
                            <span className="ml-2 text-sm text-zinc-400">per troy ounce</span>
                        </p>
                    )}
                    <div className="mt-4">
                        <LastUpdated updatedAt={updatedAt} />
                    </div>
                </div>
            </section>

            <LazyPriceChart
                gold={history.gold}
                silver={history.silver}
                source={history.source}
                defaultMetal={slug}
                lockMetal
                title={`${chart.name} price history`}
            />

            <AnalysisSection gold={gold} silver={silver} />

            <RelatedLinks
                links={
                    slug === 'gold'
                        ? relatedLinks('goldToday', 'calculator', 'history', 'silverChart', 'news', 'goldInsights')
                        : relatedLinks('silverToday', 'goldChart', 'calculator', 'history', 'news', 'silverInsights')
                }
            />
        </>
    );
}
