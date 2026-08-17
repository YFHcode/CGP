'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { WEIGHT_UNITS, pricePerUnit, hasRangeData, type WeightUnit } from '@/lib/conversions';
import { formatMetalPrice, formatPercent } from '@/lib/currencies';
import type { GoldPriceResponse, MetalSymbol } from '@/types';
import { ToggleGroup } from './UnitToggle';

interface PriceCardProps {
    symbol: MetalSymbol;
    name: string;
    data: Pick<
        GoldPriceResponse,
        'price' | 'ch' | 'chp' | 'high_price' | 'low_price' | 'prev_close_price'
    > | null;
}

export function PriceCard({ symbol, name, data }: PriceCardProps) {
    const { convertPrice, currency, activeCurrency } = useCurrency();
    const [unit, setUnit] = useState<WeightUnit>('oz');

    if (!data) {
        return (
            <div
                className="rounded-xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm"
                aria-busy="true"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10">
                        <span className="font-bold text-gold-400">{symbol}</span>
                    </div>
                    <div>
                        <h3 className="font-medium text-zinc-300">{name}</h3>
                        <p className="text-xs text-zinc-400">Price unavailable</p>
                    </div>
                </div>
                <p className="mt-4 text-sm text-zinc-400">
                    We couldn&apos;t load the latest {name.toLowerCase()} price. It will reappear
                    automatically once the next update succeeds.
                </p>
            </div>
        );
    }

    /**
     * Convert once at the ounce level, then derive every displayed figure from
     * the same converted base — high/low used to stay in USD-per-ounce while
     * the headline price changed unit and currency underneath them.
     */
    const convertedOz = convertPrice(data.price);
    const usingFallback = convertedOz === null;
    const baseOz = convertedOz ?? data.price;
    const displayCurrency = usingFallback ? 'USD' : currency;

    const convert = (usd: number) => (usingFallback ? usd : convertPrice(usd) ?? usd);

    const priceInUnit = pricePerUnit(baseOz, unit);
    const highInUnit = pricePerUnit(convert(data.high_price), unit);
    const lowInUnit = pricePerUnit(convert(data.low_price), unit);

    // The keyless fallback provider (see scripts/refresh-data.mjs) has no day
    // range or change to report, and sets high_price === low_price === price
    // and ch/chp to 0 rather than inventing them. Showing that as a real
    // "$X — $X" range or a green 0.00% badge reads as a dead market instead
    // of the honest "we don't know" it actually is.
    const hasRange = hasRangeData(data);
    const isPositive = data.ch > 0;
    const isFlat = data.ch === 0;
    const TrendIcon = isFlat ? Minus : isPositive ? ArrowUp : ArrowDown;

    return (
        <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm transition-all hover:border-gold-500/30 hover:bg-zinc-900/80">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-500/10 blur-2xl transition-all group-hover:bg-gold-500/20" />

            <div className="relative">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/20 bg-gradient-to-br from-gold-400/20 to-gold-600/20">
                            <span className="font-bold text-gold-400">{symbol}</span>
                        </div>
                        <div>
                            <h3 className="font-medium text-zinc-300">{name}</h3>
                            <p className="text-xs text-zinc-400">Spot price ({displayCurrency})</p>
                        </div>
                    </div>
                    {hasRange ? (
                        <div
                            className={cn(
                                'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                                isFlat
                                    ? 'bg-zinc-500/10 text-zinc-300'
                                    : isPositive
                                      ? 'bg-green-500/10 text-green-300'
                                      : 'bg-red-500/10 text-red-300'
                            )}
                        >
                            <TrendIcon className="h-3 w-3" aria-hidden="true" />
                            {/* Percent is already signed by formatPercent, so the
                                arrow no longer doubles up on the minus sign. */}
                            <span>{formatPercent(data.chp)}</span>
                            <span className="sr-only">
                                {isFlat ? 'unchanged' : isPositive ? 'up' : 'down'} since previous
                                close
                            </span>
                        </div>
                    ) : (
                        <div className="rounded-full bg-zinc-500/10 px-2 py-1 text-xs font-medium text-zinc-500">
                            Change unavailable
                        </div>
                    )}
                </div>

                <ToggleGroup
                    label={`${name} price unit`}
                    options={WEIGHT_UNITS}
                    value={unit}
                    onChange={setUnit}
                    size="sm"
                    className="mb-3"
                />

                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight text-white">
                        {formatMetalPrice(priceInUnit, displayCurrency)}
                    </span>
                    <span className="text-sm text-zinc-400">per {unit}</span>
                </div>

                {hasRange ? (
                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                        <div>
                            <p className="text-xs text-zinc-400">Day high ({unit})</p>
                            <p className="text-sm font-medium text-zinc-200">
                                {formatMetalPrice(highInUnit, displayCurrency)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400">Day low ({unit})</p>
                            <p className="text-sm font-medium text-zinc-200">
                                {formatMetalPrice(lowInUnit, displayCurrency)}
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="mt-4 border-t border-white/5 pt-4 text-xs text-zinc-400">
                        Day range unavailable for this update.
                    </p>
                )}

                {usingFallback && currency !== activeCurrency && (
                    <p className="mt-3 text-xs text-amber-300/90">
                        {currency} rates are unavailable, so this price is shown in USD.
                    </p>
                )}
            </div>
        </div>
    );
}
