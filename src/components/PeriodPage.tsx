import Link from 'next/link';
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { LazyPriceChart } from './LazyPriceChart';
import { Breadcrumbs } from './Breadcrumbs';
import { RelatedLinks, relatedLinks } from './RelatedLinks';
import { JsonLd } from './JsonLd';
import { CurrencyValue, CurrencyCode } from './CurrencyValue';
import { cn } from '@/lib/utils';
import { breadcrumbSchema, SITE_URL } from '@/lib/seo';
import { periodQuestions, periodFaqSchema } from '@/lib/period-faq';
import { computeDayProfile } from '@/lib/day-character';
import { leadBlock, contextBlocks, characterQuestions } from '@/lib/day-narrative';
import { computeInsights } from '@/lib/period-insights';
import { computeDayHeadline } from '@/lib/day-headline';
import {
    METAL_ROUTES,
    adjacentPeriods,
    parentPeriod,
    slugForKey,
    formatLongDate,
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
    /** Why this day is notable, if it is. Empty for routine days. */
    notableReasons?: string[];
}

export function PeriodPage({
    metal,
    stats,
    series,
    otherSeries,
    source,
    notableReasons = [],
}: PeriodPageProps) {
    const route = METAL_ROUTES[metal];
    const { period } = stats;
    const { previous, next } = adjacentPeriods(series, period);
    const parent = parentPeriod(period);

    const isUp = stats.change > 0;
    const isFlat = stats.change === 0;
    const TrendIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

    const isSingleDay = period.kind === 'day';
    const name = route.name.toLowerCase();

    // A punchy, data-derived headline for day pages — "highest close since
    // 3 June 2026" rather than a bare stats table. Null when the day has
    // nothing genuinely distinctive about it.
    const headline = isSingleDay ? computeDayHeadline(series, period.key, route.name) : null;

    // Long-tail Q&A generated from the real figures. This is where search
    // intent like "what was the average gold price in March 2026" is targeted.
    const insights = computeInsights(stats, series, otherSeries, metal);

    /**
     * Per-day character, which decides which sections and which questions this
     * page renders. Day pages previously shared a fixed skeleton and a fixed
     * question set, so stripping the date and the numbers left them 90-100%
     * identical to one another. Selecting by what the session actually was
     * means a record close and a flat Tuesday no longer read the same.
     */
    const profile = isSingleDay ? computeDayProfile(series, period.key) : null;
    const lead = profile ? leadBlock(profile, route.name) : null;
    const context = profile ? contextBlocks(profile, route.name) : [];

    const questions = [
        ...periodQuestions(metal, stats, insights),
        ...(profile ? characterQuestions(profile, route.name) : []),
    ];
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

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
                        url: `${SITE_URL}${route.base}/${period.slug}`,
                        // Recommended (not required) fields for Google Dataset Search
                        // eligibility, a separate index from web search that surfaces
                        // pages carrying Dataset markup — cheap to add, currently unused
                        // by any competing site in this niche.
                        license: `${SITE_URL}/terms`,
                        isAccessibleForFree: true,
                        keywords: [`${name} price`, `${name} price history`, 'precious metals data'],
                        temporalCoverage: `${period.start}/${period.end}`,
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
                        {route.name} price {isSingleDay ? 'on' : 'in'} {period.label}
                    </h1>
                    {headline && (
                        <p className="mb-3 text-lg font-medium text-gold-300">{headline.text}</p>
                    )}
                    <p className="max-w-3xl text-zinc-300">
                        {isSingleDay ? (
                            <>
                                {route.name} {stats.isComplete ? 'closed' : 'was last quoted'} at{' '}
                                <strong className="text-white"><CurrencyValue usd={stats.close} /></strong> per troy ounce
                                {' '}on {period.label}
                                {!stats.isComplete && ', with trading still in progress'}
                                {stats.previousClose !== null && (
                                    <>
                                        , {isFlat ? 'unchanged from' : isUp ? 'up' : 'down'}{' '}
                                        {!isFlat && (
                                            <>
                                                <CurrencyValue usd={Math.abs(stats.change)} /> (
                                                {Math.abs(stats.changePct).toFixed(2)}%) from
                                            </>
                                        )}{' '}
                                        the previous close of <CurrencyValue usd={stats.previousClose} />
                                    </>
                                )}
                                .
                            </>
                        ) : (
                            <>
                                {route.name} {stats.isComplete ? 'ranged' : 'has ranged'} between{' '}
                                <strong className="text-white"><CurrencyValue usd={stats.low} /></strong> and{' '}
                                <strong className="text-white"><CurrencyValue usd={stats.high} /></strong> per troy ounce
                                {stats.isComplete ? ' during' : ' so far in'} {period.label}
                                {!stats.isComplete && (
                                    <> (through {formatLongDate(stats.points[stats.points.length - 1].date)})</>
                                )}
                                , averaging <CurrencyValue usd={stats.average} /> across{' '}
                                {stats.points.length} trading {stats.points.length === 1 ? 'day' : 'days'}
                                {stats.isComplete
                                    ? <>. It finished the period at <CurrencyValue usd={stats.close} /></>
                                    : <> so far. It is currently at <CurrencyValue usd={stats.close} /></>}
                                {stats.previousClose !== null && (
                                    <>
                                        , {isFlat ? 'level with' : isUp ? 'up' : 'down'}{' '}
                                        {!isFlat && <>{Math.abs(stats.changePct).toFixed(2)}% from</>}{' '}
                                        <CurrencyValue usd={stats.previousClose} />
                                    </>
                                )}
                                .
                            </>
                        )}
                    </p>
                </div>
            </section>

            {notableReasons.length > 0 && (
                <section className="border-y border-gold-500/20 bg-gold-500/5 py-4">
                    <div className="container mx-auto px-4">
                        <p className="text-sm text-gold-200">
                            <strong className="font-semibold">Notable session:</strong>{' '}
                            {notableReasons.join('; ')}.
                        </p>
                    </div>
                </section>
            )}

            {/*
                Character-driven narrative. What appears here — and whether
                anything appears at all — depends on what the session actually
                was, so two adjacent day pages no longer share a skeleton. An
                unremarkable day renders nothing and is legitimately shorter
                rather than padded to match its neighbours.
            */}
            {(lead || context.length > 0) && (
                <section className="border-b border-white/5 bg-zinc-900/20 py-8">
                    <div className="container mx-auto px-4">
                        {lead && (
                            <div className="mb-6 max-w-3xl">
                                <h2 className="mb-2 text-xl font-bold text-white">
                                    {lead.heading}
                                </h2>
                                <p className="text-zinc-300">{lead.body}</p>
                            </div>
                        )}
                        {context.length > 0 && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {context.map((block) => (
                                    <article
                                        key={block.heading}
                                        className="rounded-lg border border-white/10 p-4"
                                    >
                                        <h3 className="mb-1 text-sm font-semibold text-gold-400">
                                            {block.heading}
                                        </h3>
                                        <p className="text-sm text-zinc-300">{block.body}</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Key figures */}
            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[
                            {
                                label: isSingleDay
                                    ? stats.isComplete
                                        ? 'Close'
                                        : 'Latest price'
                                    : stats.isComplete
                                      ? 'Period close'
                                      : 'Latest close (period in progress)',
                                value: <CurrencyValue usd={stats.close} />,
                            },
                            {
                                label: stats.isComplete ? 'High' : 'High so far',
                                value: <CurrencyValue usd={stats.high} />,
                                sub: formatLongDate(stats.highDate),
                            },
                            {
                                label: stats.isComplete ? 'Low' : 'Low so far',
                                value: <CurrencyValue usd={stats.low} />,
                                sub: formatLongDate(stats.lowDate),
                            },
                            {
                                label: isSingleDay ? 'Previous close' : stats.isComplete ? 'Average' : 'Average so far',
                                value: isSingleDay
                                    ? stats.previousClose !== null
                                        ? <CurrencyValue usd={stats.previousClose} />
                                        : '—'
                                    : <CurrencyValue usd={stats.average} />,
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
                        {isFlat ? (
                            'No change'
                        ) : (
                            <>
                                {isUp ? 'Up' : 'Down'} <CurrencyValue usd={Math.abs(stats.change)} /> (
                                {Math.abs(stats.changePct).toFixed(2)}%)
                            </>
                        )}
                        <span className="font-normal text-zinc-400">
                            {stats.previousClose !== null ? 'vs previous close' : 'over the period'}
                        </span>
                    </div>
                </div>
            </section>

            {/* Extended statistics. These make an otherwise formulaic page
                carry genuinely page-specific information. */}
            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        {route.name} price detail, {period.label}
                    </h2>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                            <h3 className="mb-4 font-semibold text-white">Price by weight</h3>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between gap-4">
                                    <dt className="text-zinc-400">Per troy ounce</dt>
                                    <dd className="font-medium text-zinc-100"><CurrencyValue usd={stats.close} /></dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-zinc-400">Per gram</dt>
                                    <dd className="font-medium text-zinc-100"><CurrencyValue usd={insights.perGram} /></dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-zinc-400">Per kilogram</dt>
                                    <dd className="font-medium text-zinc-100"><CurrencyValue usd={insights.perKilo} /></dd>
                                </div>
                                {insights.ratioClose !== null && (
                                    <div className="flex justify-between gap-4 border-t border-white/5 pt-2">
                                        <dt className="text-zinc-400">Gold / silver ratio</dt>
                                        <dd className="font-medium text-zinc-100">
                                            {insights.ratioClose.toFixed(1)}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </div>

                        {metal === 'XAU' ? (
                            <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                                <h3 className="mb-4 font-semibold text-white">
                                    Melt value per gram by karat
                                </h3>
                                <dl className="space-y-2 text-sm">
                                    {insights.perGramByKarat.map((entry) => (
                                        <div key={entry.karat} className="flex justify-between gap-4">
                                            <dt className="text-zinc-400">
                                                {entry.karat}
                                                <span className="ml-2 text-xs text-zinc-500">
                                                    {(entry.purity * 100).toFixed(1)}%
                                                </span>
                                            </dt>
                                            <dd className="font-medium text-zinc-100">
                                                <CurrencyValue usd={entry.value} />
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="mt-3 text-xs text-zinc-400">
                                    Metal value only, before dealer margins and fabrication.
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                                <h3 className="mb-4 font-semibold text-white">Session summary</h3>
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-zinc-400">Higher closes</dt>
                                        <dd className="font-medium text-green-300">{insights.upDays}</dd>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-zinc-400">Lower closes</dt>
                                        <dd className="font-medium text-red-300">{insights.downDays}</dd>
                                    </div>
                                </dl>
                            </div>
                        )}
                    </div>

                    {!isSingleDay && (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                { label: 'Higher closes', value: String(insights.upDays) },
                                { label: 'Lower closes', value: String(insights.downDays) },
                                {
                                    label: 'Peak-to-trough range',
                                    value: `${insights.rangePct.toFixed(1)}%`,
                                },
                                {
                                    label: 'Daily volatility',
                                    value: `${insights.volatilityPct.toFixed(2)}%`,
                                },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-xl border border-white/10 bg-black/40 p-4"
                                >
                                    <dt className="text-xs text-zinc-400">{item.label}</dt>
                                    <dd className="mt-1 text-lg font-bold text-white">{item.value}</dd>
                                </div>
                            ))}
                        </div>
                    )}

                    {isSingleDay && (insights.weekAgoClose !== null || insights.monthAgoClose !== null) && (
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {insights.weekAgoClose !== null && insights.weekAgoChangePct !== null && (
                                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                                    <dt className="text-xs text-zinc-400">Versus a week ago</dt>
                                    <dd className="mt-1 text-lg font-bold text-white">
                                        {pct(insights.weekAgoChangePct)}
                                    </dd>
                                    <dd className="mt-1 text-xs text-zinc-400">
                                        from <CurrencyValue usd={insights.weekAgoClose} />
                                    </dd>
                                </div>
                            )}
                            {insights.monthAgoClose !== null && insights.monthAgoChangePct !== null && (
                                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                                    <dt className="text-xs text-zinc-400">Versus a month ago</dt>
                                    <dd className="mt-1 text-lg font-bold text-white">
                                        {pct(insights.monthAgoChangePct)}
                                    </dd>
                                    <dd className="mt-1 text-xs text-zinc-400">
                                        from <CurrencyValue usd={insights.monthAgoClose} />
                                    </dd>
                                </div>
                            )}
                        </div>
                    )}

                    {(insights.bestDay || insights.yearAgoClose !== null) && (
                        <div className="mt-6 space-y-2 text-sm text-zinc-300">
                            {insights.bestDay && insights.worstDay && !isSingleDay && (
                                <p>
                                    The strongest session of {period.label} was{' '}
                                    <Link
                                        href={`${route.base}/${slugForKey(insights.bestDay.date, 'day')}`}
                                        className="text-gold-400 hover:text-gold-300"
                                    >
                                        {formatLongDate(insights.bestDay.date)}
                                    </Link>{' '}
                                    at {pct(insights.bestDay.pct)}, and the weakest{' '}
                                    <Link
                                        href={`${route.base}/${slugForKey(insights.worstDay.date, 'day')}`}
                                        className="text-gold-400 hover:text-gold-300"
                                    >
                                        {formatLongDate(insights.worstDay.date)}
                                    </Link>{' '}
                                    at {pct(insights.worstDay.pct)}.
                                </p>
                            )}
                            {insights.yearAgoClose !== null && insights.yearAgoChangePct !== null && (
                                <p>
                                    Twelve months earlier {name} traded around{' '}
                                    <CurrencyValue usd={insights.yearAgoClose} />, making this a{' '}
                                    {pct(insights.yearAgoChangePct)} move year on year.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Only chart multi-point periods; a single day is one dot. */}
            {stats.points.length > 1 && (
                <LazyPriceChart
                    lockMetal
                    metal={metal === 'XAU' ? 'gold' : 'silver'}
                    series={stats.points}
                    source={source}
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
                                        <th scope="col" className="px-4 py-3 font-semibold text-white">Close (<CurrencyCode />/oz)</th>
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
                                                        formatLongDate(point.date)
                                                    ) : (
                                                        <Link
                                                            href={`${route.base}/${slugForKey(point.date, 'day')}`}
                                                            className="text-gold-400 hover:text-gold-300"
                                                        >
                                                            {formatLongDate(point.date)}
                                                        </Link>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2"><CurrencyValue usd={point.close} /></td>
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
                                                    {delta === null ? (
                                                        '—'
                                                    ) : (
                                                        <>
                                                            {delta > 0 ? '+' : delta < 0 ? '−' : ''}
                                                            <CurrencyValue usd={Math.abs(delta)} />
                                                        </>
                                                    )}
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

            {/* Long-tail Q&A. Question-shaped headings with the answer directly
                beneath match how these searches are actually phrased, and give
                even a single-day page substantive unique content. */}
            <section aria-labelledby="faq-heading" className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 id="faq-heading" className="mb-2 text-2xl font-bold text-white">
                        {route.name} price {isSingleDay ? 'on' : 'in'} {period.label}: common questions
                    </h2>
                    <p className="mb-6 text-xs text-zinc-500">
                        Figures in this section are shown in USD, independent of the currency selected above.
                    </p>
                    <div className="mx-auto max-w-4xl divide-y divide-white/5">
                        {questions.map((entry) => (
                            <div key={entry.question} className="py-5">
                                <h3 className="mb-2 text-lg font-semibold text-white">
                                    {entry.question}
                                </h3>
                                <p className="text-zinc-300">{entry.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

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
                    metal === 'XAU' ? 'goldInsights' : 'silverInsights',
                    'news'
                )}
            />
        </>
    );
}
