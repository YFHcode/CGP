import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { CurrencyValue } from './CurrencyValue';
import type { GoldPriceResponse } from '@/types';

/**
 * Platinum and palladium, compact, beneath the gold and silver cards.
 *
 * Deliberately smaller than the main cards rather than a matching four-across
 * grid: gold and silver carry almost all the demand and get the live ticker,
 * while these two are twice-daily snapshots. Giving all four equal visual
 * weight would imply equal freshness, which would be untrue.
 *
 * Renders nothing at all until the refresh populates them, so the homepage
 * never shows a row of dashes.
 */
export function MinorMetalStrip({
    platinum,
    palladium,
}: {
    platinum: GoldPriceResponse | null;
    palladium: GoldPriceResponse | null;
}) {
    const entries = [
        { data: platinum, name: 'Platinum', href: '/platinum-price', symbol: 'XPT' },
        { data: palladium, name: 'Palladium', href: '/palladium-price', symbol: 'XPD' },
    ].filter((e) => e.data && e.data.price > 0);

    if (entries.length === 0) return null;

    return (
        <div className="container mx-auto px-4">
            <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3">
                {entries.map(({ data, name, href, symbol }) => (
                    <Link
                        key={symbol}
                        href={href}
                        className="group flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-2.5 transition-colors hover:border-gold-500/30"
                    >
                        <span className="text-xs font-semibold text-zinc-500">{symbol}</span>
                        <span className="text-sm text-zinc-300">{name}</span>
                        <span className="text-sm font-bold text-white">
                            <CurrencyValue usd={(data as GoldPriceResponse).price} />
                        </span>
                        <ArrowRight
                            className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-gold-400"
                            aria-hidden="true"
                        />
                    </Link>
                ))}
            </div>
        </div>
    );
}
