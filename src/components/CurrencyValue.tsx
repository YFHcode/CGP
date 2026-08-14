'use client';

import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency, formatMetalPrice } from '@/lib/currencies';

/**
 * Renders a USD figure converted into the visitor's selected currency.
 *
 * Archive pages used to hardcode every price as USD text, so switching the
 * header currency selector had no effect on them — the numbers just sat
 * there unconverted while every other page reacted. This is a client leaf
 * (same pattern as PriceCard/PriceChart) so the surrounding page can stay a
 * server component; only this figure re-renders when currency changes.
 */
export function CurrencyValue({
    usd,
    format = 'metal',
}: {
    usd: number;
    /**
     * 'metal' keeps formatMetalPrice's variable precision, which gives three
     * decimals below 10 — right for a per-gram spot price, where the third
     * digit is real information.
     *
     * 'money' forces the ordinary two decimals. Melt values are amounts
     * someone might actually sell for, and a column mixing "$4.655" with
     * "$23.27" reads as a rendering fault rather than added precision.
     */
    format?: 'metal' | 'money';
}) {
    const { convertPrice, activeCurrency } = useCurrency();
    const value = convertPrice(usd) ?? usd;

    return (
        <>
            {format === 'money'
                ? formatCurrency(value, activeCurrency, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                  })
                : formatMetalPrice(value, activeCurrency)}
        </>
    );
}

/** The currency code the page is actually showing right now, e.g. for "(USD/oz)" style labels. */
export function CurrencyCode() {
    const { activeCurrency } = useCurrency();
    return <>{activeCurrency}</>;
}
