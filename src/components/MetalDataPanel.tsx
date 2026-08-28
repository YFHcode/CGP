import { horizonReturns, seriesExtremes } from '@/lib/performance';
import { PerformanceTable } from './PerformanceTable';
import { SeriesStats } from './SeriesStats';
import { MetalComparison } from './MetalComparison';
import type { AnyMetalSymbol, HistoryPoint } from '@/types';

/**
 * Performance, record extremes and the cross-metal table as one block.
 *
 * These three always appear together, on the today pages, the chart pages and
 * the platinum and palladium pages, so they ship as one component rather than
 * three call sites repeated five times.
 *
 * Everything here is computed from the same daily series the charts already
 * use — no additional fetch, no additional data source. It exists because the
 * pages were thin: a visitor arriving on "gold price today" got a number, a
 * chart and some prose, while every comparable site opens with a performance
 * table and the record high.
 */
export function MetalDataPanel({
    series,
    symbol,
    metalName,
    routeBase,
    unit = 'USD per troy ounce',
}: {
    series: HistoryPoint[];
    symbol: AnyMetalSymbol;
    metalName: string;
    /** Archive base like '/gold-price', or null where no day archive exists. */
    routeBase: string | null;
    unit?: string;
}) {
    const rows = horizonReturns(series);
    const extremes = seriesExtremes(series);
    if (rows.length === 0 || !extremes) return null;

    const lower = metalName.toLowerCase();

    return (
        <section aria-labelledby="performance-heading" className="bg-black py-12">
            <div className="container mx-auto px-4">
                <h2 id="performance-heading" className="mb-2 text-2xl font-bold text-white">
                    {metalName} price performance
                </h2>
                <p className="mb-6 max-w-3xl text-sm text-zinc-400">
                    How the {lower} price has moved over each period, measured from our own recorded
                    closes. Every row names the date and closing price it is measured from, so each
                    figure can be checked rather than taken on trust.
                </p>

                <div className="grid gap-6 lg:grid-cols-2">
                    <PerformanceTable rows={rows} metalName={metalName} />

                    <div className="space-y-6">
                        <SeriesStats
                            extremes={extremes}
                            metalName={metalName}
                            routeBase={routeBase}
                            unit={unit}
                        />
                        <MetalComparison highlight={symbol} />
                    </div>
                </div>
            </div>
        </section>
    );
}
