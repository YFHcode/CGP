import { cn } from '@/lib/utils';
import { formatMetalPrice, formatPercent } from '@/lib/currencies';
import type { AnnualReturn } from '@/lib/insights-metrics';

interface AnnualReturnsTableProps {
    returns: AnnualReturn[];
    metalName: string;
}

/**
 * Ranked full-year returns — a real `<table>` rather than a chart, so the
 * figures are readable without JavaScript and are exactly "the underlying
 * data, not just a picture", same principle as the daily-closes tables on
 * the archive pages.
 */
export function AnnualReturnsTable({ returns, metalName }: AnnualReturnsTableProps) {
    if (returns.length === 0) return null;

    const maxAbs = Math.max(...returns.map((r) => Math.abs(r.changePct)), 1);

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900">
                    <tr className="border-b border-white/10">
                        <th scope="col" className="px-4 py-3 font-semibold text-white">Year</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-white">Year-end close</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-white">Return</th>
                        <th scope="col" className="px-4 py-3 font-semibold text-white sr-only sm:not-sr-only">
                            Scale
                        </th>
                    </tr>
                </thead>
                <tbody className="text-zinc-300">
                    {returns.map((entry) => {
                        const isUp = entry.changePct > 0;
                        const isFlat = entry.changePct === 0;
                        return (
                            <tr key={entry.year} className="border-b border-white/5">
                                <td className="px-4 py-2 font-medium text-zinc-100">
                                    {entry.year}
                                    {!entry.isComplete && (
                                        <span className="ml-2 rounded-full bg-gold-500/10 px-2 py-0.5 text-xs font-normal text-gold-300">
                                            in progress
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2">{formatMetalPrice(entry.close, 'USD')}</td>
                                <td
                                    className={cn(
                                        'px-4 py-2 font-medium',
                                        isFlat ? 'text-zinc-400' : isUp ? 'text-green-300' : 'text-red-300'
                                    )}
                                >
                                    {formatPercent(entry.changePct)}
                                </td>
                                <td className="hidden px-4 py-2 sm:table-cell">
                                    <div
                                        className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800"
                                        role="img"
                                        aria-label={`${metalName} ${isUp ? 'gained' : 'lost'} ${Math.abs(entry.changePct).toFixed(1)}% in ${entry.year}`}
                                    >
                                        <div
                                            className={cn('h-full rounded-full', isUp ? 'bg-green-500' : 'bg-red-500')}
                                            style={{ width: `${(Math.abs(entry.changePct) / maxAbs) * 100}%` }}
                                        />
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
