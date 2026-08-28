import Link from 'next/link';

import { getPrices, getMinorMetal, getHistory } from '@/lib/prices';
import { formatPercent } from '@/lib/currencies';
import { dayChangePct } from '@/lib/performance';
import { CurrencyValue } from './CurrencyValue';
import type { AnyMetalSymbol, GoldPriceResponse, HistoryPoint } from '@/types';

/**
 * All four metals side by side, on every metal page rather than only the
 * homepage.
 *
 * Someone reading about platinum is one question away from "and what is
 * palladium doing?", and until now the answer lived only on the homepage. This
 * is also the single cheapest way to give each metal page a reason to link to
 * the other three, which the internal link graph badly needed.
 *
 * An async server component so call sites stay one line. getPrices and
 * getMinorMetal are both request-cached, so rendering this alongside a page
 * that already reads prices costs no extra file reads.
 */

interface Row {
    symbol: AnyMetalSymbol;
    name: string;
    href: string;
    quote: GoldPriceResponse | null;
    /** Used only as a day-change fallback where the quote carries none. */
    series: HistoryPoint[];
}

export async function MetalComparison({
    highlight,
    title = 'Precious metals today',
}: {
    /** Symbol of the page this table sits on, shown as the current row. */
    highlight?: AnyMetalSymbol;
    title?: string;
}) {
    const [{ gold, silver }, history, platinum, palladium] = await Promise.all([
        getPrices(),
        getHistory(),
        getMinorMetal('XPT'),
        getMinorMetal('XPD'),
    ]);

    const all: Row[] = [
        {
            symbol: 'XAU',
            name: 'Gold',
            href: '/gold-price-today',
            quote: gold,
            series: history.gold,
        },
        {
            symbol: 'XAG',
            name: 'Silver',
            href: '/silver-price-today',
            quote: silver,
            series: history.silver,
        },
        {
            symbol: 'XPT',
            name: 'Platinum',
            href: '/platinum-price',
            quote: platinum.quote,
            series: platinum.series,
        },
        {
            symbol: 'XPD',
            name: 'Palladium',
            href: '/palladium-price',
            quote: palladium.quote,
            series: palladium.series,
        },
    ];
    const rows = all.filter((row) => row.quote && row.quote.price > 0);

    // Nothing rather than a table of dashes if the refresh has not populated.
    if (rows.length < 2) return null;

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[30rem] text-left text-sm">
                <caption className="sr-only">{title}</caption>
                <thead className="bg-zinc-900">
                    <tr className="border-b border-white/10">
                        <th scope="col" className="px-4 py-3 font-semibold text-white">
                            Metal
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold text-white">
                            Price / oz
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold text-white">
                            Day change
                        </th>
                    </tr>
                </thead>
                <tbody className="text-zinc-300">
                    {rows.map(({ symbol, name, href, quote, series }) => {
                        const price = quote as GoldPriceResponse;
                        const change = dayChangePct(price, series);
                        const isCurrent = symbol === highlight;
                        return (
                            <tr
                                key={symbol}
                                className={`border-b border-white/5 last:border-0 ${
                                    isCurrent ? 'bg-gold-500/5' : ''
                                }`}
                            >
                                <th scope="row" className="px-4 py-2.5 font-medium">
                                    {isCurrent ? (
                                        <span className="text-white">
                                            {name}
                                            <span className="ml-2 text-xs font-normal text-zinc-500">
                                                this page
                                            </span>
                                        </span>
                                    ) : (
                                        <Link
                                            href={href}
                                            className="text-gold-400 hover:text-gold-300"
                                        >
                                            {name}
                                        </Link>
                                    )}
                                    <span className="ml-2 text-xs font-normal text-zinc-500">
                                        {symbol}
                                    </span>
                                </th>
                                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-white">
                                    <CurrencyValue usd={price.price} />
                                </td>
                                <td
                                    className={`px-4 py-2.5 text-right tabular-nums ${
                                        change === null
                                            ? 'text-zinc-400'
                                            : change > 0
                                              ? 'text-green-300'
                                              : change < 0
                                                ? 'text-red-300'
                                                : 'text-zinc-300'
                                    }`}
                                >
                                    {change === null ? '—' : formatPercent(change)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
