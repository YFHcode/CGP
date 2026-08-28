import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { LazyPriceChart } from '@/components/LazyPriceChart';
import { MetalDataPanel } from '@/components/MetalDataPanel';
import { LazyTrendChartWrapper, LazyVolatilityChartWrapper } from '@/components/LazyInsightsCharts';
import {
    LazyRsiChart,
    LazyMacdChart,
    LazyBollingerChart,
    LazyRatioChart,
} from '@/components/LazyIndicatorCharts';
import { DataExport } from '@/components/DataExport';
import { AnalysisSection } from '@/components/AnalysisSection';
import { LastUpdated } from '@/components/LastUpdated';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices, getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { formatMetalPrice, formatPercent } from '@/lib/currencies';
import { movingAverages, computeDrawdowns, rollingVolatility } from '@/lib/insights-metrics';
import { rsi, macd, bollinger, goldSilverRatio, latest } from '@/lib/indicators';

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

/**
 * Serve only the slugs generateStaticParams returns; anything else 404s at the
 * routing layer.
 *
 * Without this, an unknown slug renders on demand and notFound() returns the
 * not-found *body* with a 200 status — a soft 404. Google reports those in
 * Search Console and spends crawl budget on them, and bot probes for URLs like
 * /charts/wordpress generate them constantly. The valid set here is closed and
 * fully known (the metals we chart), so nothing legitimate is lost.
 */
export const dynamicParams = false;

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
    const series = slug === 'gold' ? history.gold : history.silver;
    const insightsPath = slug === 'gold' ? '/gold-price-insights' : '/silver-price-insights';

    // Under ~60 points a 50-day average and a rolling 30-day volatility
    // window can't be computed honestly, so this section is skipped rather
    // than shown full of nulls — same threshold as the insights pages.
    const hasEnoughHistory = series.length >= 60;
    const ma = hasEnoughHistory ? movingAverages(series) : [];
    const drawdowns = hasEnoughHistory ? computeDrawdowns(series) : null;
    const volatility = hasEnoughHistory ? rollingVolatility(series) : [];

    // Indicator panels. Computed on the server from the same series the chart
    // draws, so the numbers under the chart and in the panels cannot disagree.
    const rsiSeries = hasEnoughHistory ? rsi(series) : [];
    const macdSeries = hasEnoughHistory ? macd(series) : [];
    const bollingerSeries = hasEnoughHistory ? bollinger(series) : [];
    const ratioSeries =
        hasEnoughHistory && history.gold.length > 0 && history.silver.length > 0
            ? goldSilverRatio(history.gold, history.silver)
            : [];
    const currentRsi = latest(rsiSeries);
    const metalColor = slug === 'gold' ? '#d6a93e' : '#94a3b8';

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
                lockMetal
                metal={slug}
                series={series}
                source={history.source}
                title={`${chart.name} price history`}
            />

            <MetalDataPanel
                series={series}
                symbol={slug === 'gold' ? 'XAU' : 'XAG'}
                metalName={chart.name}
                routeBase={slug === 'gold' ? '/gold-price' : '/silver-price'}
            />

            <AnalysisSection gold={gold} silver={silver} />

            {hasEnoughHistory && drawdowns && (
                <section className="bg-black py-12">
                    <div className="container mx-auto px-4">
                        <h2 className="mb-2 text-2xl font-bold text-white">
                            {chart.name} trend and volatility
                        </h2>
                        <p className="mb-6 max-w-2xl text-sm text-zinc-400">
                            50 and 200-day moving averages, and how much {chart.name.toLowerCase()}
                            &apos;s daily moves have varied recently.
                        </p>

                        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                                <dt className="text-xs text-zinc-400">Vs all-time high</dt>
                                <dd
                                    className={`mt-1 text-lg font-bold ${drawdowns.currentDrawdownPct >= 0 ? 'text-green-300' : 'text-red-300'}`}
                                >
                                    {drawdowns.currentDrawdownPct >= 0
                                        ? 'At record'
                                        : formatPercent(drawdowns.currentDrawdownPct)}
                                </dd>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                                <dt className="text-xs text-zinc-400">Days since record</dt>
                                <dd className="mt-1 text-lg font-bold text-white">
                                    {drawdowns.daysSinceAllTimeHigh}
                                </dd>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                                <dt className="text-xs text-zinc-400">30-day volatility</dt>
                                <dd className="mt-1 text-lg font-bold text-white">
                                    {volatility.length > 0
                                        ? `${volatility[volatility.length - 1].volatilityPct.toFixed(2)}%`
                                        : '—'}
                                </dd>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                                <dt className="text-xs text-zinc-400">Biggest decline on record</dt>
                                <dd className="mt-1 text-lg font-bold text-white">
                                    {drawdowns.maxDrawdown ? `${drawdowns.maxDrawdown.pct.toFixed(1)}%` : '—'}
                                </dd>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <LazyTrendChartWrapper points={ma} metalColor={metalColor} metalName={chart.name} />
                            <LazyVolatilityChartWrapper points={volatility} />
                        </div>

                        {/*
                            Technical panels. Everything here is computable from
                            daily closes alone — the stored series carries no
                            intraday range, which rules out ATR, stochastics and
                            anything candle-based, so those are deliberately
                            absent rather than approximated from closes.
                        */}
                        <div className="mt-10">
                            <h2 className="text-2xl font-bold text-white">
                                Technical analysis
                            </h2>
                            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                                Standard indicators computed from the full daily record.
                                {currentRsi !== null && (
                                    <>
                                        {' '}
                                        {chart.name}&apos;s 14-day RSI is currently{' '}
                                        <strong className="text-zinc-200">
                                            {currentRsi.toFixed(0)}
                                        </strong>
                                        {currentRsi >= 70
                                            ? ' — in the range usually described as overbought.'
                                            : currentRsi <= 30
                                              ? ' — in the range usually described as oversold.'
                                              : ' — neither overbought nor oversold.'}
                                    </>
                                )}{' '}
                                None of this is a trading signal or financial advice.
                            </p>
                        </div>

                        {rsiSeries.length > 0 && <LazyRsiChart points={rsiSeries} />}
                        {macdSeries.length > 0 && <LazyMacdChart points={macdSeries} />}
                        {bollingerSeries.length > 0 && (
                            <LazyBollingerChart points={bollingerSeries} closes={series} />
                        )}
                        {ratioSeries.length > 0 && <LazyRatioChart points={ratioSeries} />}

                        <div className="mt-6 flex flex-wrap items-center gap-4">
                            <Link
                                href={insightsPath}
                                className="inline-flex items-center gap-2 font-medium text-gold-400 hover:text-gold-300"
                            >
                                See the full trend, seasonality and milestone analysis
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                            <DataExport
                                points={series}
                                filename={`chartgoldprice-${slug}-daily-closes.csv`}
                                label={`Download ${chart.name.toLowerCase()} history`}
                            />
                        </div>
                    </div>
                </section>
            )}

            <RelatedLinks
                links={
                    slug === 'gold'
                        ? relatedLinks('goldToday', 'goldForecast', 'goldInsights', 'history', 'silverChart', 'api')
                        : relatedLinks('silverToday', 'silverForecast', 'silverInsights', 'silverHistory', 'goldChart', 'api')
                }
            />
        </>
    );
}
