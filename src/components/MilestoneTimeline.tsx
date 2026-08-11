import Link from 'next/link';

import { formatMetalPrice } from '@/lib/currencies';
import { formatLongDate, slugForKey } from '@/lib/history-periods';
import type { HistoryPoint } from '@/types';

interface MilestoneTimelineProps {
    /** date -> reasons, from findNotableDays(). */
    notable: Map<string, string[]>;
    series: HistoryPoint[];
    routeBase: string;
}

/**
 * Every notable day on record, newest first, each with the real reason it
 * qualified and a link to its own page. This is the "dynamic interpretation
 * with milestones" view — nothing here is written by hand, it is
 * findNotableDays() (the same function that drives the "Notable session"
 * banner on the day pages) rendered as a chronology instead of a one-off note.
 */
export function MilestoneTimeline({ notable, series, routeBase }: MilestoneTimelineProps) {
    const closeByDate = new Map(series.map((p) => [p.date, p.close]));
    const entries = [...notable.entries()]
        .filter(([date]) => closeByDate.has(date))
        .sort((a, b) => (a[0] < b[0] ? 1 : -1)); // newest first

    if (entries.length === 0) return null;

    return (
        <div className="max-h-[32rem] overflow-auto rounded-xl border border-white/10">
            <ol className="divide-y divide-white/5">
                {entries.map(([date, reasons]) => (
                    <li key={date} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                        <div>
                            <Link
                                href={`${routeBase}/${slugForKey(date, 'day')}`}
                                className="font-medium text-gold-400 hover:text-gold-300"
                            >
                                {formatLongDate(date)}
                            </Link>
                            <span className="ml-2 text-sm text-zinc-300">{reasons.join('; ')}.</span>
                        </div>
                        <span className="text-sm font-medium text-zinc-100">
                            {formatMetalPrice(closeByDate.get(date)!, 'USD')}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
