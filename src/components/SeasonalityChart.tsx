import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/currencies';
import type { MonthlySeasonality } from '@/lib/insights-metrics';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface SeasonalityChartProps {
    seasonality: MonthlySeasonality[];
    metalName: string;
}

/**
 * Average % change by calendar month, plain CSS bars rather than a charting
 * library — 12 categories with a direct label on every bar reads better as
 * markup than as an image, and it costs no extra client JavaScript.
 */
export function SeasonalityChart({ seasonality, metalName }: SeasonalityChartProps) {
    const withSamples = seasonality.filter((m) => m.sampleCount > 0);
    if (withSamples.length === 0) return null;

    const maxAbs = Math.max(...seasonality.map((m) => Math.abs(m.avgChangePct)), 1);
    const years = Math.max(...seasonality.map((m) => m.sampleCount));

    return (
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            <div className="flex h-48 items-end gap-2 sm:gap-3">
                {seasonality.map((entry) => {
                    const name = MONTH_NAMES[entry.month - 1];
                    const hasData = entry.sampleCount > 0;
                    const isUp = entry.avgChangePct > 0;
                    const heightPct = hasData ? Math.max((Math.abs(entry.avgChangePct) / maxAbs) * 100, 4) : 0;

                    return (
                        <div key={entry.month} className="flex flex-1 flex-col items-center gap-1">
                            <div className="flex h-32 w-full flex-col justify-end">
                                {hasData && (
                                    <span
                                        className={cn(
                                            'mb-1 text-center text-[10px] font-medium sm:text-xs',
                                            isUp ? 'text-green-300' : 'text-red-300'
                                        )}
                                    >
                                        {formatPercent(entry.avgChangePct)}
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        'w-full rounded-t',
                                        !hasData ? 'bg-zinc-800' : isUp ? 'bg-green-500' : 'bg-red-500'
                                    )}
                                    style={{ height: `${heightPct}%` }}
                                    role="img"
                                    aria-label={
                                        hasData
                                            ? `${name}: ${metalName} averaged ${formatPercent(entry.avgChangePct)} across ${entry.sampleCount} year${entry.sampleCount === 1 ? '' : 's'}`
                                            : `${name}: no complete data yet`
                                    }
                                />
                            </div>
                            <span className="text-xs text-zinc-400">{name}</span>
                        </div>
                    );
                })}
            </div>
            <p className="mt-4 text-xs text-zinc-400">
                Average % change across up to {years} year{years === 1 ? '' : 's'} of complete calendar
                months on record. Some months have fewer years of data than others and are less
                statistically reliable.
            </p>
        </div>
    );
}
