import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { CurrencyValue } from './CurrencyValue';
import type { HomeInsights, RangePosition } from '@/lib/home-insights';

/**
 * The homepage's "why this site" section.
 *
 * A visitor can read a spot price straight off a search result. What they
 * cannot get there is context — whether today was unusual, whether the ratio is
 * historically stretched, how close the metal is to its yearly extremes. Those
 * need the archive, which is the one asset here that competitors mostly lack,
 * so this is what the homepage leads with after the prices themselves.
 *
 * A server component throughout: every figure is computed at render time and
 * none of it is interactive, so there is no reason to ship it to the client.
 * Prices go through CurrencyValue, which is the existing client leaf, so the
 * section still respects the selected currency without becoming client-side.
 */

function RangeBar({ label, range, href }: { label: string; range: RangePosition; href: string }) {
    const pct = range.position * 100;

    return (
        <Link
            href={href}
            className="group rounded-xl border border-white/10 bg-zinc-900/50 p-5 transition-colors hover:border-gold-500/30"
        >
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">
                {pct.toFixed(0)}%
                <span className="ml-1 text-xs font-normal text-zinc-400">of its 52-week range</span>
            </p>

            <div
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="img"
                aria-label={`${pct.toFixed(0)} percent of the 52-week range`}
            >
                <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300"
                    style={{ width: `${pct}%` }}
                />
            </div>

            <p className="mt-2 flex justify-between text-[11px] text-zinc-500">
                <span>
                    <CurrencyValue usd={range.low} />
                </span>
                <span>
                    <CurrencyValue usd={range.high} />
                </span>
            </p>
        </Link>
    );
}

function Stat({
    label,
    value,
    detail,
    href,
}: {
    label: string;
    value: string;
    detail: string;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="group rounded-xl border border-white/10 bg-zinc-900/50 p-5 transition-colors hover:border-gold-500/30"
        >
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{value}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{detail}</p>
        </Link>
    );
}

export function MarketPulse({ insights }: { insights: HomeInsights }) {
    const { todaysRead, ratio, goldRsi, goldRange52, silverRange52, goldForecast, coverage } =
        insights;

    const hasAnything =
        todaysRead || ratio || goldRsi !== null || goldRange52 || silverRange52 || goldForecast;
    if (!hasAnything) return null;

    return (
        <section className="border-y border-white/5 bg-zinc-900/20 py-14">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white">Where the market stands</h2>
                        <p className="mt-2 max-w-2xl text-zinc-300">
                            Context you can only get from the full record, not from a single quote.
                        </p>
                    </div>
                    {coverage && (
                        <p className="text-xs text-zinc-500">
                            Computed from {coverage.points.toLocaleString('en-US')} daily closes
                            across {coverage.years} years
                        </p>
                    )}
                </div>

                {todaysRead && (
                    <div className="mb-8 rounded-xl border border-gold-500/20 bg-gold-500/5 p-6">
                        <p className="mb-1 text-xs uppercase tracking-wide text-gold-400">
                            Today&apos;s session
                        </p>
                        <h3 className="mb-2 text-xl font-bold text-white">{todaysRead.heading}</h3>
                        <p className="max-w-3xl text-sm text-zinc-300">{todaysRead.body}</p>
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {goldRange52 && (
                        <RangeBar label="Gold" range={goldRange52} href="/charts/gold" />
                    )}
                    {silverRange52 && (
                        <RangeBar label="Silver" range={silverRange52} href="/charts/silver" />
                    )}

                    {ratio && (
                        <Stat
                            label="Gold-to-silver ratio"
                            value={ratio.current.toFixed(1)}
                            detail={
                                `Higher than ${ratio.percentile.toFixed(0)}% of all days on ` +
                                `record. The long-run median is ${ratio.median.toFixed(0)}.`
                            }
                            href="/gold-to-silver-ratio"
                        />
                    )}

                    {goldRsi !== null && (
                        <Stat
                            label="Gold momentum (RSI 14)"
                            value={goldRsi.toFixed(0)}
                            detail={
                                goldRsi >= 70
                                    ? 'In the range usually called overbought — though metals can hold an extreme for weeks.'
                                    : goldRsi <= 30
                                      ? 'In the range usually called oversold — though metals can hold an extreme for weeks.'
                                      : 'Between the conventional overbought and oversold thresholds.'
                            }
                            href="/charts/gold"
                        />
                    )}
                </div>

                {goldForecast && (
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 p-6">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-zinc-400">
                                Next {goldForecast.days} sessions
                            </p>
                            <p className="mt-1 text-lg text-white">
                                Gold is likely to trade between{' '}
                                <strong>
                                    <CurrencyValue usd={goldForecast.low} />
                                </strong>{' '}
                                and{' '}
                                <strong>
                                    <CurrencyValue usd={goldForecast.high} />
                                </strong>
                            </p>
                            <p className="mt-1 text-xs text-zinc-500">
                                An 80% statistical range, not a prediction of direction — and the
                                page shows how accurate it has been.
                            </p>
                        </div>
                        <Link
                            href="/gold-price-forecast"
                            className="inline-flex items-center gap-2 rounded-lg border border-gold-500/30 px-4 py-2 text-sm font-medium text-gold-300 transition-colors hover:bg-gold-500/10"
                        >
                            See the forecast
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
