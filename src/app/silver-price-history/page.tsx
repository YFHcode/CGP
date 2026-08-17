import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

import { LazyPriceChart } from '@/components/LazyPriceChart';
import { DataExport } from '@/components/DataExport';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getHistory } from '@/lib/prices';
import { breadcrumbSchema, datasetSchema, pageMetadata, SITE_URL } from '@/lib/seo';
import { localeAlternates } from '@/lib/locale-pages';
import { describeCoverage } from '@/lib/coverage';
import { annualReturns, computeDrawdowns } from '@/lib/insights-metrics';
import { AnnualReturnsTable } from '@/components/AnnualReturnsTable';

/**
 * Silver's counterpart to /gold-price-history.
 *
 * "silver price history", "price of silver over time" and "zilverprijs
 * grafiek 10 jaar" were all drawing impressions with no silver history page
 * existing at all — the demand was landing on whatever silver page Google
 * could find instead.
 */

export const revalidate = 86400;

const baseMetadata = pageMetadata({
    title: 'Silver Price History — Charts and Annual Returns',
    description:
        'Historical silver prices with interactive charts from one week to the full record, ' +
        'annual returns by year, the largest drawdowns on record, and a downloadable CSV of ' +
        'every close we hold.',
    path: '/silver-price-history',
    keywords: [
        'silver price history',
        'historical silver prices',
        'silver price chart history',
        'price of silver over time',
        'silver price 10 years',
    ],
});

// Reciprocal hreflang back to /nl, the localized counterpart of this page —
// without this, /nl pointed at the English original but not vice versa.
export const metadata: Metadata = {
    ...baseMetadata,
    alternates: {
        ...baseMetadata.alternates,
        languages: localeAlternates('/silver-price-history'),
    },
};

export default async function SilverPriceHistoryPage() {
    const history = await getHistory();
    const series = history.silver;

    const returns = series.length > 0 ? annualReturns(series) : [];
    const drawdowns = series.length > 0 ? computeDrawdowns(series) : null;

    const trail = [{ name: 'Silver price history', href: '/silver-price-history' }];
    const facts = describeCoverage(series);
    const coverage = facts ? `${facts.start} to ${facts.end}` : null;

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    datasetSchema({
                        name: 'Silver price history',
                        description: facts
                            ? `Silver closing prices in USD per troy ounce — ${facts.sentence} — ` +
                              'with annual returns and drawdowns.'
                            : 'Silver closing prices in USD per troy ounce, with annual returns and drawdowns.',
                        path: '/silver-price-history',
                        keywords: ['silver price', 'silver price history', 'precious metals data'],
                        variableMeasured: 'Silver price (USD per troy ounce)',
                        temporalCoverage: coverage ? coverage.replace(' to ', '/') : null,
                        distribution: [
                            {
                                encodingFormat: 'application/json',
                                contentUrl: `${SITE_URL}/api/data?history=silver`,
                            },
                        ],
                    }),
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-12">
                <div className="container mx-auto px-4">
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <Calendar className="h-8 w-8 text-gold-400" aria-hidden="true" />
                        <h1 className="text-4xl font-bold text-white md:text-5xl">
                            Silver Price History
                        </h1>
                    </div>
                    <p className="mx-auto max-w-3xl text-center text-zinc-300">
                        Every silver close we hold{facts ? ` — ${facts.sentence}` : ''} — charted
                        from one week to the full record, with annual returns, the deepest
                        drawdowns, and the underlying data available to download.
                    </p>
                </div>
            </section>

            <LazyPriceChart
                lockMetal
                metal="silver"
                series={series}
                source={history.source}
                title="Historical silver closing prices"
            />

            {drawdowns && (
                <section className="bg-black py-10">
                    <div className="container mx-auto px-4">
                        <h2 className="mb-6 text-2xl font-bold text-white">Silver annual returns</h2>
                        <AnnualReturnsTable returns={returns} metalName="Silver" />

                        {drawdowns.maxDrawdown && (
                            <p className="mt-6 max-w-3xl text-sm text-zinc-300">
                                The largest peak-to-trough decline on record was{' '}
                                <strong className="text-white">
                                    {drawdowns.maxDrawdown.pct.toFixed(1)}%
                                </strong>
                                , from {drawdowns.maxDrawdown.peakDate} to{' '}
                                {drawdowns.maxDrawdown.troughDate}
                                {drawdowns.maxDrawdown.recoveryDate
                                    ? `, recovering by ${drawdowns.maxDrawdown.recoveryDate}.`
                                    : ', and it has not yet recovered.'}{' '}
                                Silver is materially more volatile than gold — roughly half its demand
                                is industrial, so it tracks the economic cycle as well as safe-haven
                                flows.
                            </p>
                        )}

                        <div className="mt-6">
                            <DataExport
                                points={series}
                                filename="chartgoldprice-silver-daily-closes.csv"
                                label="Download silver history"
                            />
                        </div>
                    </div>
                </section>
            )}

            <section className="bg-zinc-900/30 py-12">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-center text-2xl font-bold text-white">
                        Reading silver&apos;s history
                    </h2>
                    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
                        {[
                            [
                                'Industrial demand moves it',
                                'Roughly half of silver demand is industrial — solar, electronics, brazing — so it falls harder in downturns than gold does.',
                            ],
                            [
                                'Higher volatility, both ways',
                                'Silver routinely posts larger percentage moves than gold in both directions, which is why its drawdowns look severe next to gold’s.',
                            ],
                            [
                                'Watch the ratio',
                                'The gold-to-silver ratio is the standard way to judge whether silver is cheap relative to gold rather than cheap outright.',
                            ],
                        ].map(([title, body]) => (
                            <article key={title} className="rounded-lg border border-white/10 p-6 text-center">
                                <h3 className="mb-3 text-xl font-semibold text-gold-400">{title}</h3>
                                <p className="text-sm text-zinc-300">{body}</p>
                            </article>
                        ))}
                    </div>
                    <p className="mx-auto mt-8 max-w-4xl text-center text-sm text-zinc-400">
                        For the current market, see{' '}
                        <Link href="/silver-price-today" className="text-gold-400 hover:text-gold-300">
                            today&apos;s silver price
                        </Link>
                        , or compare with{' '}
                        <Link href="/gold-price-history" className="text-gold-400 hover:text-gold-300">
                            gold price history
                        </Link>
                        .
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    'silverArchive',
                    'silverChart',
                    'silverInsights',
                    'silverToday',
                    'silverCalculator',
                    'ratio'
                )}
            />
        </>
    );
}
