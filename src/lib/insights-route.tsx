import { getHistory } from '@/lib/prices';
import { METAL_ROUTES } from '@/lib/history-periods';
import { findNotableDays } from '@/lib/notable-days';
import {
    movingAverages,
    computeDrawdowns,
    rollingVolatility,
    annualReturns,
    monthlySeasonality,
} from '@/lib/insights-metrics';
import { insightsQuestions } from '@/lib/insights-faq';
import { periodFaqSchema } from '@/lib/period-faq';
import { pageMetadata, breadcrumbSchema, SITE_URL } from '@/lib/seo';
import { formatMetalPrice, formatPercent } from '@/lib/currencies';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { LazyTrendChartWrapper, LazyVolatilityChartWrapper } from '@/components/LazyInsightsCharts';
import { AnnualReturnsTable } from '@/components/AnnualReturnsTable';
import { SeasonalityChart } from '@/components/SeasonalityChart';
import { MilestoneTimeline } from '@/components/MilestoneTimeline';
import type { HistoryPoint, MetalSymbol } from '@/types';

/**
 * Shared implementation for /gold-price-insights and /silver-price-insights.
 *
 * Every figure — moving averages, drawdowns, volatility, annual returns,
 * seasonality, milestones — is computed from the same price history the rest
 * of the site already stores. Nothing here is fetched separately or
 * hand-picked.
 */

const METAL_COLOR: Record<MetalSymbol, string> = { XAU: '#d6a93e', XAG: '#94a3b8' };

function seriesFor(metal: MetalSymbol, history: { gold: HistoryPoint[]; silver: HistoryPoint[] }) {
    return metal === 'XAU' ? history.gold : history.silver;
}

export function insightsMetadata(metal: MetalSymbol) {
    const route = METAL_ROUTES[metal];
    const name = route.name.toLowerCase();
    const path = `${route.base}-insights`;

    return pageMetadata({
        title: `${route.name} Price Insights — Trends, Volatility & Records`,
        description: `${route.name} analytics computed from our own price history: 50/200-day moving averages, rolling volatility, drawdowns, annual returns by year, monthly seasonality and every notable record on record.`,
        path,
        keywords: [
            `${name} moving average`,
            `${name} volatility`,
            `${name} seasonality`,
            `${name} annual returns`,
            `${name} price records`,
            `${name} drawdown`,
        ],
    });
}

export async function renderInsightsPage(metal: MetalSymbol) {
    const route = METAL_ROUTES[metal];
    const name = route.name.toLowerCase();
    const path = `${route.base}-insights`;
    const history = await getHistory();
    const series = seriesFor(metal, history);

    const trail = [{ name: `${route.name} price insights`, href: path }];

    if (series.length < 60) {
        // Under ~60 points several metrics (a 50-day average, a rolling
        // 30-day volatility window) can't be computed honestly yet. Publish
        // a minimal, honest page rather than charts full of nulls.
        return (
            <>
                <JsonLd
                    schema={breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href })))}
                />
                <Breadcrumbs trail={trail} />
                <section className="bg-zinc-900/50 py-16">
                    <div className="container mx-auto px-4 text-center">
                        <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">
                            {route.name} price insights
                        </h1>
                        <p className="mx-auto max-w-2xl text-zinc-300">
                            We&apos;re still building up enough price history for reliable trend and
                            volatility analysis — that needs at least 60 trading days. Check back as
                            more data accumulates.
                        </p>
                    </div>
                </section>
                <RelatedLinks
                    links={relatedLinks(
                        metal === 'XAU' ? 'goldToday' : 'silverToday',
                        'history',
                        'calculator'
                    )}
                />
            </>
        );
    }

    const ma = movingAverages(series);
    const drawdowns = computeDrawdowns(series);
    const volatility = rollingVolatility(series);
    const returns = annualReturns(series);
    const seasonality = monthlySeasonality(series);
    const notable = findNotableDays(series);
    const latest = series[series.length - 1];
    const metalColor = METAL_COLOR[metal];

    const questions = insightsQuestions({
        metalName: route.name,
        series,
        drawdowns,
        volatility,
        returns,
        seasonality,
    });

    const isAboveAllTimeHigh = drawdowns.currentDrawdownPct >= 0;

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    {
                        '@context': 'https://schema.org',
                        '@type': 'Dataset',
                        name: `${route.name} price analytics`,
                        description: `Moving averages, volatility, drawdowns, annual returns and seasonality computed from ${name} daily closing prices.`,
                        url: `${SITE_URL}${path}`,
                        license: `${SITE_URL}/terms`,
                        isAccessibleForFree: true,
                        keywords: [`${name} price`, `${name} analytics`, 'precious metals data'],
                        temporalCoverage: `${series[0].date}/${latest.date}`,
                        variableMeasured: `${route.name} price (USD per troy ounce)`,
                        creator: { '@type': 'Organization', name: 'ChartGoldPrice', url: SITE_URL },
                    },
                    periodFaqSchema(questions),
                ]}
            />

            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        {route.name} price insights
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        Trend, volatility, drawdowns, annual returns and seasonality for {name},
                        computed from {series.length} days of our own recorded prices — not opinion,
                        not a forecast.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                            <dt className="text-xs text-zinc-400">Latest close</dt>
                            <dd className="mt-1 text-xl font-bold text-white">
                                {formatMetalPrice(latest.close, 'USD')}
                            </dd>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                            <dt className="text-xs text-zinc-400">Vs all-time high</dt>
                            <dd
                                className={`mt-1 text-xl font-bold ${isAboveAllTimeHigh ? 'text-green-300' : 'text-red-300'}`}
                            >
                                {isAboveAllTimeHigh ? 'At record' : formatPercent(drawdowns.currentDrawdownPct)}
                            </dd>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                            <dt className="text-xs text-zinc-400">Days since record</dt>
                            <dd className="mt-1 text-xl font-bold text-white">
                                {drawdowns.daysSinceAllTimeHigh}
                            </dd>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
                            <dt className="text-xs text-zinc-400">30-day volatility</dt>
                            <dd className="mt-1 text-xl font-bold text-white">
                                {volatility.length > 0
                                    ? `${volatility[volatility.length - 1].volatilityPct.toFixed(2)}%`
                                    : '—'}
                            </dd>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        {route.name} price trend: 50 and 200-day averages
                    </h2>
                    <p className="mb-6 text-sm text-zinc-400">
                        The 200-day average trending above the 50-day is the classic reading of a
                        longer-term downtrend, and vice-versa for an uptrend.
                    </p>
                    <LazyTrendChartWrapper points={ma} metalColor={metalColor} metalName={route.name} />
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        Volatility and drawdowns
                    </h2>
                    <p className="mb-6 max-w-3xl text-sm text-zinc-400">
                        Rolling 30-day volatility is the standard deviation of daily % moves — higher
                        means bigger, less predictable swings, not necessarily a falling price.
                    </p>
                    <LazyVolatilityChartWrapper points={volatility} />

                    {drawdowns.maxDrawdown && (
                        <p className="mt-6 max-w-3xl text-sm text-zinc-300">
                            The largest decline on record was{' '}
                            <strong className="text-white">{drawdowns.maxDrawdown.pct.toFixed(1)}%</strong>,
                            from {formatMetalPrice(drawdowns.maxDrawdown.peakClose, 'USD')} on{' '}
                            {drawdowns.maxDrawdown.peakDate} to{' '}
                            {formatMetalPrice(drawdowns.maxDrawdown.troughClose, 'USD')} on{' '}
                            {drawdowns.maxDrawdown.troughDate}
                            {drawdowns.maxDrawdown.recoveryDate
                                ? `, recovering back to that level by ${drawdowns.maxDrawdown.recoveryDate}.`
                                : ', and it has not yet recovered.'}
                        </p>
                    )}
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        {route.name} annual returns
                    </h2>
                    <AnnualReturnsTable returns={returns} metalName={route.name} />
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        Is {name} seasonal?
                    </h2>
                    <p className="mb-6 max-w-3xl text-sm text-zinc-400">
                        Average % change by calendar month, across every complete month we hold. A
                        short history means this is an observation, not a proven pattern.
                    </p>
                    <SeasonalityChart seasonality={seasonality} metalName={route.name} />
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        Notable {name} milestones
                    </h2>
                    <p className="mb-6 max-w-3xl text-sm text-zinc-400">
                        Every record high and low, and every outsized single-day move, computed
                        directly from the recorded series — newest first.
                    </p>
                    <MilestoneTimeline notable={notable} series={series} routeBase={route.base} />
                </div>
            </section>

            <section aria-labelledby="insights-faq-heading" className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 id="insights-faq-heading" className="mb-6 text-2xl font-bold text-white">
                        {route.name} price insights: common questions
                    </h2>
                    <div className="mx-auto max-w-4xl divide-y divide-white/5">
                        {questions.map((entry) => (
                            <div key={entry.question} className="py-5">
                                <h3 className="mb-2 text-lg font-semibold text-white">{entry.question}</h3>
                                <p className="text-zinc-300">{entry.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    metal === 'XAU' ? 'goldToday' : 'silverToday',
                    metal === 'XAU' ? 'goldArchive' : 'silverArchive',
                    metal === 'XAU' ? 'goldChart' : 'silverChart',
                    'calculator',
                    'ratio',
                    'news'
                )}
            />
        </>
    );
}
