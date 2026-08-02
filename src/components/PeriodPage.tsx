import Link from 'next/link';
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { PriceChart } from './PriceChart';
import { Breadcrumbs } from './Breadcrumbs';
import { RelatedLinks, relatedLinks } from './RelatedLinks';
import { JsonLd } from './JsonLd';
import { cn } from '@/lib/utils';
import { breadcrumbSchema } from '@/lib/seo';
import {
    METAL_ROUTES,
    adjacentPeriods,
    parentPeriod,
    slugForKey,
    type PeriodStats,
} from '@/lib/history-periods';
import type { HistoryPoint, MetalSymbol } from '@/types';

interface PeriodPageProps {
    metal: MetalSymbol;
    stats: PeriodStats;
    /** Full series, for computing neighbours. */
    series: HistoryPoint[];
    /** The other metal's series, so the chart component still works. */
    otherSeries: HistoryPoint[];
    source: string | null;
}

/** Formats a plain USD figure. These pages are USD-only for stable indexing. */
function usd(value: number): string {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(iso: string): string {
    const date = new Date(`${iso}T00:00:00Z`);
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

export function PeriodPage({ metal, stats, series, otherSeries, source }: PeriodPageProps) {
    const route = METAL_ROUTES[metal];
    const { period } = stats;
    const { previous, next } = adjacentPeriods(series, period);
    const parent = parentPeriod(period);

    const isUp = stats.change > 0;
    const isFlat = stats.change === 0;
    const TrendIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

    const isSingleDay = period.kind === 'day';
    const name = route.name.toLowerCase();

    const trail = [
        { name: `${route.name} price history`, href: route.base },
        ...(parent && period.kind === 'day'
            ? [{ name: parent.label, href: `${route.base}/${parent.slug}` }]
            : []),
        { name: period.label, href: `${route.base}/${period.slug}` },
    ];

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(
                        trail.map((crumb) => ({ name: crumb.name, path: crumb.href }))
                    ),
                    {
                        '@context': 'https://schema.org',
                        '@type': 'Dataset',
                        name: `${route.name} price, ${period.label}`,
                        description: `Daily ${name} closing prices for ${period.label}, including high, low and average.`,
                        temporalCoverage: `${period.start}/${period.end}`,
                        variableMeasured: `${route.name} price (USD per troy ounce)`,
                        creator: { '@type': 'Organization', name: 'ChartGoldPrice' },
                    },
                ]}
            />

            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        {route.name} price {isSingleDay ? 'on' : 'in'} {period.label}
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        {isSingleDay ? (
                            <>
                                {route.name} closed at <strong className="text-white">{usd(stats.close)}</strong> per
                                troy ounce on {period.label}
                                {stats.previousClose !== null && (
                                    <>
                                        , {isFlat ? 'unchanged from' : isUp ? 'up' : 'down'}{' '}
                                        {!isFlat && (
                                            <>
                                                {usd(Math.abs(stats.change))} (
                                                {Math.abs(stats.changePct).toFixed(2)}%) from
                                            </>
                                        )}{' '}
                                        the previous close of {usd(stats.previousClose)}
                                    </>
                                )}
                                .
                            </>
                        ) : (
                            <>
                                {route.name} ranged between{' '}
                                <strong className="text-white">{usd(stats.low)}</strong> and{' '}
                                <strong className="text-white">{usd(stats.high)}</strong> per troy ounce
                                during {period.label}, averaging {usd(stats.average)} across{' '}
                                {stats.points.length} trading {stats.points.length === 1 ? 'day' : 'days'}
                                . It finished the period at {usd(stats.close)}
                                {stats.previousClose !== null && (
                                    <>
                                        , {isFlat ? 'level with' : isUp ? 'up' : 'down'}{' '}
                                        {!isFlat && <>{Math.abs(stats.changePct).toFixed(2)}% from</>}{' '}
                                        {usd(stats.previousClose)}
                                    </>
                                )}
                                .
                            </>
                        )}
                    </p>
                </div>
            </section>

            {/* Key figures */}
            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[
                            { label: isSingleDay ? 'Close' : 'Period close', value: usd(stats.close) },
                            { label: 'High', value: usd(stats.high), sub: formatDate(stats.highDate) },
                            { label: 'Low', value: usd(stats.low), sub: formatDate(stats.lowDate) },
                            {
                                label: isSingleDay ? 'Previous close' : 'Average',
                                value: isSingleDay
                                    ? stats.previousClose !== null
                                        ? usd(stats.previousClose)
                                        : '—'
                                    : usd(stats.average),
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-xl border border-white/10 bg-zinc-900/50 p-4"
                            >
                                <dt className="text-xs text-zinc-400">{item.label}</dt>
                                <dd className="mt-1 text-xl font-bold text-white">{item.value}</dd>
                                {item.sub && <dd className="mt-1 text-xs text-zinc-400">{item.sub}</dd>}
                            </div>
                        ))}
                    </dl>

                    <div
                        className={cn(
                            'mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
                            isFlat
                                ? 'bg-zinc-500/10 text-zinc-300'
                                : isUp
                                  ? 'bg-green-500/10 text-green-300'
                                  : 'bg-red-500/10 text-red-300'
                        )}
                    >
                        <TrendIcon className="h-4 w-4" aria-hidden="true" />
                        {isFlat
                            ? 'No change'
                            : `${isUp ? 'Up' : 'Down'} ${usd(Math.abs(stats.change))} (${Math.abs(stats.changePct).toFixed(2)}%)`}
                        <span className="font-normal text-zinc-400">
                            {stats.previousClose !== null ? 'vs previous close' : 'over the period'}
                        </span>
                    </div>
                </div>
            </section>

            {/* Only chart multi-point periods; a single day is one dot. */}
            {stats.points.length > 1 && (
                <PriceChart
                    gold={metal === 'XAU' ? stats.points : otherSeries}
                    silver={metal === 'XAG' ? stats.points : otherSeries}
                    source={source}
                    defaultMetal={metal === 'XAU' ? 'gold' : 'silver'}
                    lockMetal
                    title={`${route.name} price chart, ${period.label}`}
                />
            )}

            {/* Daily closes table — the underlying data, not just a picture. */}
            {stats.points.length > 1 && (
                <section className="bg-black py-10">
                    <div className="container mx-auto px-4">
                        <h2 className="mb-4 text-2xl font-bold text-white">
                            Daily {name} closes, {period.label}
                        </h2>
                        <div className="max-h-[28rem] overflow-auto rounded-xl border border-white/10">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-zinc-900">
                                    <tr className="border-b border-white/10">
                                        <th scope="col" className="px-4 py-3 font-semibold text-white">Date</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-white">Close (USD/oz)</th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-white">Change</th>
                                    </tr>
                                </thead>
                                <tbody className="text-zinc-300">
                                    {stats.points.map((point, index) => {
                                        const prev =
                                            index > 0 ? stats.points[index - 1].close : stats.previousClose;
                                        const delta = prev !== null ? point.close - prev : null;
                                        return (
                                            <tr key={point.date} className="border-b border-white/5">
                                                <td className="px-4 py-2">
                                                    {period.kind === 'day' ? (
                                                        formatDate(point.date)
                                                    ) : (
                                                        <Link
                                                            href={`${route.base}/${slugForKey(point.date, 'day')}`}
                                                            className="text-gold-400 hover:text-gold-300"
                                                        >
                                                            {formatDate(point.date)}
                                                        </Link>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">{usd(point.close)}</td>
                                                <td
                                                    className={cn(
                                                        'px-4 py-2',
                                                        delta === null
                                                            ? 'text-zinc-500'
                                                            : delta > 0
                                                              ? 'text-green-300'
                                                              : delta < 0
                                                                ? 'text-red-300'
                                                                : 'text-zinc-400'
                                                    )}
                                                >
                                                    {delta === null
                                                        ? '—'
                                                        : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${usd(Math.abs(delta))}`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-xs text-zinc-400">
                            {source ? `Source: ${source}. ` : ''}
                            Figures are indicative reference prices, not trading quotes.
                        </p>
                    </div>
                </section>
            )}

            {/* Previous / next navigation — also spreads link equity along the archive. */}
            <section className="bg-zinc-900/30 py-8">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4">
                    {previous ? (
                        <Link
                            href={`${route.base}/${previous.slug}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-gold-500/30 hover:text-gold-300"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            {route.name} price, {previous.label}
                        </Link>
                    ) : (
                        <span />
                    )}

                    {parent && (
                        <Link
                            href={`${route.base}/${parent.slug}`}
                            className="text-sm text-gold-400 hover:text-gold-300"
                        >
                            View all of {parent.label}
                        </Link>
                    )}

                    {next ? (
                        <Link
                            href={`${route.base}/${next.slug}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-gold-500/30 hover:text-gold-300"
                        >
                            {route.name} price, {next.label}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    ) : (
                        <span />
                    )}
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    metal === 'XAU' ? 'goldToday' : 'silverToday',
                    'calculator',
                    'history',
                    metal === 'XAU' ? 'goldChart' : 'silverChart',
                    'news',
                    'blog'
                )}
            />
        </>
    );
}
