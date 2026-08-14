'use client';

import { useCurrency } from '@/contexts/CurrencyContext';
import { formatMetalPrice } from '@/lib/currencies';

/**
 * Renders a USD figure converted into the visitor's selected currency.
 *
 * Archive pages used to hardcode every price as USD text, so switching the
 * header currency selector had no effect on them — the numbers just sat
 * there unconverted while every other page reacted. This is a client leaf
 * (same pattern as PriceCard/PriceChart) so the surrounding page can stay a
 * server component; only this figure re-renders when currency changes.
 */
export function CurrencyValue({ usd }: { usd: number }) {
    const { convertPrice, activeCurrency } = useCurrency();
    return <>{formatMetalPrice(convertPrice(usd) ?? usd, activeCurrency)}</>;
}

/** The currency code the page is actually showing right now, e.g. for "(USD/oz)" style labels. */
export function CurrencyCode() {
    const { activeCurrency } = useCurrency();
    return <>{activeCurrency}</>;
}
