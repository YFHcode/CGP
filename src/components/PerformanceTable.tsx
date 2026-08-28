import { formatLongDate } from '@/lib/history-periods';
import { formatPercent } from '@/lib/currencies';
import { CurrencyValue } from './CurrencyValue';
import type { HorizonReturn } from '@/lib/performance';

/**
 * Performance across every horizon the record supports, 1 day to the full
 * series.
 *
 * Each row states the date its change is measured from. That is not decoration:
 * our series has holes in the backfilled years, so a "5 years" row may be
 * anchored a few weeks off the exact date, and a table that hid that would be
 * asking to be trusted rather than checked. Where the anchor drifted more than
 * a few days the row says so outright.
 */
export function PerformanceTable({
    rows,
    metalName,
}: {
    rows: HorizonReturn[];
    metalName: string;
}) {
    if (rows.length === 0) return null;

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">
                    {metalName} price performance over each period, with the closing price each
                    change is measured from.
                </caption>
                <thead className="bg-zinc-900">
                    <tr className="border-b border-white/10">
                        <th scope="col" className="px-4 py-3 font-semibold text-white">
                            Period
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold text-white">
                            Change
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold text-white">
                            Amount
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold text-white">
                            Measured from
                        </th>
                    </tr>
                </thead>
                <tbody className="text-zinc-300">
                    {rows.map((row) => {
                        const up = row.changePct > 0;
                        const flat = row.changePct === 0;
                        return (
                            <tr key={row.key} className="border-b border-white/5 last:border-0">
                                <th scope="row" className="px-4 py-2.5 font-medium text-zinc-100">
                                    {row.label}
                                </th>
                                <td
                                    className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                                        flat ? 'text-zinc-300' : up ? 'text-green-300' : 'text-red-300'
                                    }`}
                                >
                                    {formatPercent(row.changePct)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">
                                    {up ? '+' : row.changeAbs < 0 ? '−' : ''}
                                    <CurrencyValue usd={Math.abs(row.changeAbs)} />
                                </td>
                                <td className="px-4 py-2.5 text-zinc-400">
                                    <span className="whitespace-nowrap">
                                        {formatLongDate(row.fromDate)}
                                    </span>{' '}
                                    <span className="whitespace-nowrap">
                                        (<CurrencyValue usd={row.fromClose} />)
                                    </span>
                                    {row.anchorDriftDays > 4 && (
                                        <span className="ml-1 text-xs text-zinc-500">
                                            — nearest close, {row.anchorDriftDays} days early
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
