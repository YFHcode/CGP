import Link from 'next/link';
import { History } from 'lucide-react';

import { formatLongDate } from '@/lib/history-periods';

/**
 * Marks an archive page as historical and routes the reader to the live price.
 *
 * Search Console showed date-qualified queries for the *current* day being
 * answered by archive pages from previous years — /gold-price/2-september-2021
 * took 287 impressions at position 8 on 2 September 2026, and
 * /silver-price/2-september-2022 took 188 at position 5. Between them that is
 * a third of all impressions for the day, and neither earned a single click.
 * Google matched the day-and-month token and picked the wrong year.
 *
 * The titles now carry the date on the "today" pages, which should win most of
 * those back. This handles the remainder: when an archive page does surface
 * for a current-price search, saying so plainly turns a guaranteed bounce into
 * a click through to the page the reader wanted. It also makes the page's role
 * unambiguous to a crawler that has landed on it expecting today's number.
 *
 * Rendered only when the period genuinely ended before the newest data we
 * hold, so today's own archive page never accuses itself of being stale.
 */
export function HistoricalNotice({
    metalName,
    periodLabel,
    todayHref,
    latestDate,
}: {
    metalName: string;
    /** "2 September 2021", "August 2026", "2021". */
    periodLabel: string;
    todayHref: string;
    /** Newest date in the series, so the notice can name the live alternative. */
    latestDate: string | null;
}) {
    return (
        <div className="border-b border-gold-500/20 bg-gold-500/5">
            <div className="container mx-auto px-4 py-3">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-300">
                    <History className="h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                    <span>
                        This page is a historical record of the {metalName.toLowerCase()} price in{' '}
                        <strong className="text-white">{periodLabel}</strong>, not the current price.
                    </span>
                    <Link
                        href={todayHref}
                        className="font-medium text-gold-400 underline underline-offset-2 hover:text-gold-300"
                    >
                        See today&apos;s {metalName.toLowerCase()} price
                        {latestDate ? ` (${formatLongDate(latestDate)})` : ''}
                    </Link>
                </p>
            </div>
        </div>
    );
}
