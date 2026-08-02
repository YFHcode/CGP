'use client';

import { BarChart3, Scale, TrendingUp } from 'lucide-react';

import { useCurrency } from '@/contexts/CurrencyContext';
import { goldSilverRatio, positionInRange } from '@/lib/conversions';
import { formatMetalPrice, formatNumber, formatPercent } from '@/lib/currencies';
import type { GoldPriceResponse } from '@/types';

interface AnalysisSectionProps {
    gold: GoldPriceResponse | null;
    silver: GoldPriceResponse | null;
}

/**
 * Market statistics derived from the current quotes.
 *
 * Every figure here is computed from live data. This section previously
 * hardcoded invented "expert technical analysis" — fixed support/resistance
 * levels and a made-up volume change — which never updated and was not true.
 */
export function AnalysisSection({ gold, silver }: AnalysisSectionProps) {
    const { convertPrice, activeCurrency } = useCurrency();

    if (!gold || !silver) return null;

    const convert = (usd: number) => convertPrice(usd) ?? usd;

    const ratio = goldSilverRatio(gold.price, silver.price);
    const goldRangePosition = positionInRange(gold.price, gold.low_price, gold.high_price);

    const goldUp = gold.ch >= 0;
    const silverUp = silver.ch >= 0;

    return (
        <section className="bg-zinc-900/30 py-16">
            <div className="container mx-auto px-4">
                <div className="mb-12 text-center">
                    <h2 className="mb-4 text-3xl font-bold text-white">Market snapshot</h2>
                    <p className="mx-auto max-w-2xl text-zinc-300">
                        Key figures calculated from the latest gold and silver quotes.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {/* Gold/silver ratio */}
                    <article className="rounded-xl border border-white/10 bg-black p-6">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gold-500/10">
                            <Scale className="h-6 w-6 text-gold-400" aria-hidden="true" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-white">Gold / silver ratio</h3>
                        <p className="mb-4 text-3xl font-bold text-gold-300">{formatNumber(ratio, 1)}</p>
                        <p className="text-sm text-zinc-300">
                            One ounce of gold currently buys about {formatNumber(ratio, 1)} ounces of
                            silver. Traders watch this ratio to judge which metal looks relatively
                            cheap.
                        </p>
                    </article>

                    {/* Day's range */}
                    <article className="rounded-xl border border-white/10 bg-black p-6">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                            <BarChart3 className="h-6 w-6 text-blue-300" aria-hidden="true" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-white">Gold day range</h3>
                        <p className="mb-3 text-sm text-zinc-300">
                            {formatMetalPrice(convert(gold.low_price), activeCurrency)} —{' '}
                            {formatMetalPrice(convert(gold.high_price), activeCurrency)} per ounce
                        </p>
                        {Number.isFinite(goldRangePosition) && (
                            <>
                                <div
                                    className="h-2 w-full overflow-hidden rounded-full bg-zinc-800"
                                    role="img"
                                    aria-label={`Gold is trading ${goldRangePosition.toFixed(0)} percent of the way up its daily range`}
                                >
                                    <div
                                        className="h-full rounded-full bg-gold-500"
                                        style={{
                                            width: `${Math.min(100, Math.max(0, goldRangePosition))}%`,
                                        }}
                                    />
                                </div>
                                <p className="mt-2 text-sm text-zinc-300">
                                    Trading {goldRangePosition.toFixed(0)}% of the way up today&apos;s
                                    range.
                                </p>
                            </>
                        )}
                    </article>

                    {/* Change vs previous close */}
                    <article className="rounded-xl border border-white/10 bg-black p-6">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                            <TrendingUp className="h-6 w-6 text-purple-300" aria-hidden="true" />
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-white">Change vs previous close</h3>
                        <dl className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-300">Gold</dt>
                                <dd
                                    className={
                                        goldUp ? 'font-medium text-green-300' : 'font-medium text-red-300'
                                    }
                                >
                                    {formatPercent(gold.chp)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-zinc-300">Silver</dt>
                                <dd
                                    className={
                                        silverUp ? 'font-medium text-green-300' : 'font-medium text-red-300'
                                    }
                                >
                                    {formatPercent(silver.chp)}
                                </dd>
                            </div>
                        </dl>
                        <p className="mt-4 text-sm text-zinc-300">
                            Previous close:{' '}
                            {formatMetalPrice(convert(gold.prev_close_price), activeCurrency)} for gold.
                        </p>
                    </article>
                </div>
            </div>
        </section>
    );
}
