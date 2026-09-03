import Link from 'next/link';
import { CalendarOff } from 'lucide-react';

import { Breadcrumbs } from './Breadcrumbs';
import { RelatedLinks, relatedLinks } from './RelatedLinks';
import { CurrencyValue } from './CurrencyValue';
import { formatPercent } from '@/lib/currencies';
import { formatLongDate, slugForKey, type Period } from '@/lib/history-periods';
import { closureSentence, type ClosedDay } from '@/lib/closed-days';
import type { MetalSymbol } from '@/types';

/**
 * A date inside our range with no closing price: a weekend, or a session the
 * market did not settle.
 *
 * These URLs previously reached notFound(), which Next prerendered and served
 * as HTTP 200 with a "Page not found" body — a soft 404 under a real-looking
 * title, about six thousand of them. This answers the question instead: the
 * market was shut, and here is the close on either side.
 *
 * Deliberately noindex, follow (set in periodMetadata). Roughly six thousand
 * pages sharing one structure is the scaled-content pattern to avoid, and a
 * date with no price has nothing of its own to rank for. The value is for
 * whoever lands here from a guessed URL or an old link, and for the link
 * equity that flows on to the two real sessions either side.
 */
export function ClosedDayPage({
    metal,
    period,
    closed,
    routeBase,
    metalName,
}: {
    metal: MetalSymbol;
    period: Period;
    closed: ClosedDay;
    /** '/gold-price' or '/silver-price'. */
    routeBase: string;
    metalName: string;
}) {
    const { previous, next, changeAcross, changeAcrossPct, closureLength } = closed;
    const monthSlug = period.key.slice(0, 7);
    const monthLabel = formatLongDate(`${monthSlug}-01`).replace(/^\d+\s/, '');

    const trail = [
        { name: `${metalName} price history`, href: routeBase },
        { name: monthLabel, href: `${routeBase}/${slugForKey(monthSlug, 'month')}` },
        { name: period.label, href: `${routeBase}/${period.slug}` },
    ];

    return (
        <>
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <div className="mb-3 flex items-center gap-3">
                        <CalendarOff className="h-7 w-7 shrink-0 text-zinc-400" aria-hidden="true" />
                        <h1 className="text-3xl font-bold text-white md:text-4xl">
                            {metalName} price on {period.label}
                        </h1>
                    </div>
                    <p className="max-w-3xl text-lg text-zinc-300">
                        {closureSentence(closed, metalName)}
                    </p>
                    {closureLength > 2 && (
                        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                            The market was shut for {closureLength} days in a row around this date.
                        </p>
                    )}
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        The closes either side of {period.label}
                    </h2>

                    <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
                        {previous && (
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
                                <p className="text-xs uppercase tracking-wide text-zinc-500">
                                    Last close before
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                    <CurrencyValue usd={previous.close} />
                                </p>
                                <Link
                                    href={`${routeBase}/${slugForKey(previous.date, 'day')}`}
                                    className="mt-1 inline-block text-sm text-gold-400 hover:text-gold-300"
                                >
                                    {formatLongDate(previous.date)}
                                </Link>
                            </div>
                        )}
                        {next && (
                            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
                                <p className="text-xs uppercase tracking-wide text-zinc-500">
                                    First close after
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">
                                    <CurrencyValue usd={next.close} />
                                </p>
                                <Link
                                    href={`${routeBase}/${slugForKey(next.date, 'day')}`}
                                    className="mt-1 inline-block text-sm text-gold-400 hover:text-gold-300"
                                >
                                    {formatLongDate(next.date)}
                                </Link>
                            </div>
                        )}
                    </div>

                    {changeAcross !== null && changeAcrossPct !== null && (
                        <p className="mt-6 max-w-3xl text-zinc-300">
                            Across the closure {metalName.toLowerCase()}{' '}
                            {changeAcross === 0 ? (
                                'was unchanged'
                            ) : (
                                <>
                                    {changeAcross > 0 ? 'rose' : 'fell'}{' '}
                                    <strong
                                        className={
                                            changeAcross > 0 ? 'text-green-300' : 'text-red-300'
                                        }
                                    >
                                        <CurrencyValue usd={Math.abs(changeAcross)} /> (
                                        {formatPercent(changeAcrossPct)})
                                    </strong>
                                </>
                            )}
                            , from {formatLongDate(previous!.date)} to {formatLongDate(next!.date)}.
                        </p>
                    )}

                    <p className="mt-6 max-w-3xl text-sm text-zinc-400">
                        For the whole month, see{' '}
                        <Link
                            href={`${routeBase}/${slugForKey(monthSlug, 'month')}`}
                            className="text-gold-400 hover:text-gold-300"
                        >
                            {metalName.toLowerCase()} prices in {monthLabel}
                        </Link>
                        .
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    metal === 'XAU' ? 'goldToday' : 'silverToday',
                    metal === 'XAU' ? 'goldArchive' : 'silverArchive',
                    metal === 'XAU' ? 'goldChart' : 'silverChart',
                    metal === 'XAU' ? 'goldInsights' : 'silverInsights',
                    'calculator',
                    'ratio'
                )}
            />
        </>
    );
}
