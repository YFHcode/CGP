'use client';

import { cn } from '@/lib/utils';
import { useLivePrices } from '@/hooks/useLivePrices';
import { mergeLiveQuote } from '@/lib/live-quote';
import type { GoldPriceResponse, MetalSymbol } from '@/types';
import { PriceCard } from './PriceCard';

/**
 * Client leaf that keeps the price cards ticking.
 *
 * Deliberately a leaf rather than making Hero a client component: Hero is
 * otherwise pure layout, and the whole page's server-rendering benefit would
 * be spent to reach two numbers. Same reasoning as CurrencyValue.
 *
 * One poller feeds both cards. Each card polling for itself would double the
 * request rate to say the same thing twice.
 *
 * The server-rendered snapshot price is what ships in the HTML and what
 * crawlers see; live values only replace it after hydration, so nothing about
 * indexing or first paint changes.
 */
export function LivePriceCards({
    goldData,
    silverData,
    metal,
}: {
    goldData: GoldPriceResponse | null;
    silverData: GoldPriceResponse | null;
    metal?: MetalSymbol;
}) {
    const live = useLivePrices();

    const gold = goldData ? mergeLiveQuote(goldData, live.gold?.price) : null;
    const silver = silverData ? mergeLiveQuote(silverData, live.silver?.price) : null;

    const status = {
        isLive: live.live && live.marketOpen,
        closedReason: live.marketOpen ? null : live.closedReason,
        quotedAt: null as string | null,
    };

    return (
        <div
            className={cn(
                'mx-auto grid grid-cols-1 gap-6',
                metal ? 'max-w-md' : 'max-w-4xl md:grid-cols-2'
            )}
        >
            {(!metal || metal === 'XAU') && (
                <PriceCard
                    symbol="XAU"
                    name="Gold"
                    data={gold}
                    {...status}
                    quotedAt={live.gold?.updatedAt ?? null}
                />
            )}
            {(!metal || metal === 'XAG') && (
                <PriceCard
                    symbol="XAG"
                    name="Silver"
                    data={silver}
                    {...status}
                    quotedAt={live.silver?.updatedAt ?? null}
                />
            )}
        </div>
    );
}
