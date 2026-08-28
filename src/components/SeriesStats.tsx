import Link from 'next/link';

import { formatLongDate, slugForKey } from '@/lib/history-periods';
import { formatPercent } from '@/lib/currencies';
import { CurrencyValue } from './CurrencyValue';
import type { SeriesExtremes } from '@/lib/performance';

/**
 * A record date, linked to its own day page where one exists.
 *
 * Declared at module scope rather than inside SeriesStats: a component created
 * during render is a fresh type on every pass, which throws away state and
 * defeats reconciliation.
 */
function DayDate({ date, routeBase }: { date: string; routeBase: string | null }) {
    if (!routeBase) return <span className="text-zinc-300">{formatLongDate(date)}</span>;
    return (
        <Link
            href={`${routeBase}/${slugForKey(date, 'day')}`}
            className="text-gold-400 hover:text-gold-300"
        >
            {formatLongDate(date)}
        </Link>
    );
}

/**
 * The record at a glance: latest close, previous close, and the highest and
 * lowest closes we hold, each with its date.
 *
 * "Highest gold price ever" is a standing question this site could already
 * answer from its own data and never did — the figures existed only inside the
 * day-page narrative and the insights FAQ, never on the pages people land on.
 * Where a day archive exists the record dates link to it, which also points at
 * the day pages with the most distinctive content on them.
 *
 * The coverage row names its own start date rather than claiming "all time".
 * Our daily record begins where the backfill reached, not at the beginning of
 * the gold market, and the two are a century apart.
 */
export function SeriesStats({
    extremes,
    metalName,
    routeBase,
    frequency = 'Daily close',
    unit = 'USD per troy ounce',
}: {
    extremes: SeriesExtremes;
    metalName: string;
    /**
     * e.g. '/gold-price', so the record dates can link to their day pages.
     *
     * Null for platinum and palladium, which have no per-day archive: linking
     * their record dates would point at routes that do not exist. Those dates
     * render as plain text instead.
     */
    routeBase: string | null;
    frequency?: string;
    unit?: string;
}) {
    const { latest, previous, high, low, first, count, belowHighPct } = extremes;
    const atRecord = belowHighPct <= 0;


    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">
                    Summary statistics for the {metalName.toLowerCase()} price record.
                </caption>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                    <tr>
                        <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                            Latest close
                        </th>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-white">
                            <CurrencyValue usd={latest.close} />
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">{formatLongDate(latest.date)}</td>
                    </tr>
                    {previous && (
                        <tr>
                            <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                                Previous close
                            </th>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                                <CurrencyValue usd={previous.close} />
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400">
                                {formatLongDate(previous.date)}
                            </td>
                        </tr>
                    )}
                    <tr>
                        <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                            Highest close on record
                        </th>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-green-300">
                            <CurrencyValue usd={high.close} />
                        </td>
                        <td className="px-4 py-2.5">
                            <DayDate date={high.date} routeBase={routeBase} />
                            <span className="ml-2 text-zinc-400">
                                {atRecord
                                    ? '— trading at its record'
                                    : `— now ${formatPercent(-belowHighPct)} from it`}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                            Lowest close on record
                        </th>
                        <td className="px-4 py-2.5 text-right tabular-nums text-red-300">
                            <CurrencyValue usd={low.close} />
                        </td>
                        <td className="px-4 py-2.5">
                            <DayDate date={low.date} routeBase={routeBase} />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                            Record covered
                        </th>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                            {count.toLocaleString('en-US')} sessions
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">
                            {formatLongDate(first.date)} to {formatLongDate(latest.date)}
                        </td>
                    </tr>
                    <tr>
                        <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                            Unit and frequency
                        </th>
                        <td className="px-4 py-2.5 text-right">{unit}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{frequency}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
