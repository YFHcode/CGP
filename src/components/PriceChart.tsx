'use client';

import { useMemo, useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatMetalPrice } from '@/lib/currencies';
import type { HistoryPoint, MetalSymbol } from '@/types';

type TimeRange = '1W' | '1M' | '6M' | '1Y' | 'MAX';

/** Trailing window in days. `null` means every point we hold. */
const RANGE_DAYS: Record<TimeRange, number | null> = {
    '1W': 7,
    '1M': 30,
    '6M': 180,
    '1Y': 365,
    MAX: null,
};

const RANGES = Object.keys(RANGE_DAYS) as TimeRange[];

interface PriceChartProps {
    gold: HistoryPoint[];
    silver: HistoryPoint[];
    /** Attribution for the series, shown under the chart. */
    source?: string | null;
    /** Which metal to show first. */
    defaultMetal?: 'gold' | 'silver';
    /** Hide the metal switcher on pages that are about a single metal. */
    lockMetal?: boolean;
    title?: string;
}

/**
 * Caps how many points reach the SVG. Stored history is append-only and grows
 * forever, so MAX must downsample or the chart would slow to a crawl after a
 * few years.
 */
const MAX_PLOTTED_POINTS = 400;

/**
 * Evenly thins a series, always keeping the first and last points so the
 * endpoints of the range stay accurate.
 */
function downsample(points: HistoryPoint[], limit = MAX_PLOTTED_POINTS): HistoryPoint[] {
    if (points.length <= limit) return points;

    const step = (points.length - 1) / (limit - 1);
    const thinned: HistoryPoint[] = [];
    for (let i = 0; i < limit; i += 1) {
        thinned.push(points[Math.round(i * step)]);
    }
    return thinned;
}

/** Trims a series to the trailing window for the selected range. */
function sliceRange(points: HistoryPoint[], range: TimeRange): HistoryPoint[] {
    if (points.length === 0) return [];

    const days = RANGE_DAYS[range];
    if (days === null) return points; // MAX — everything we hold

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const windowed = points.filter((point) => {
        const time = new Date(point.date).getTime();
        return Number.isFinite(time) && time >= cutoff;
    });

    // A sparse series (e.g. only a few accumulated snapshots) would render as an
    // empty chart; fall back to the tail so something meaningful still shows.
    return windowed.length >= 2 ? windowed : points.slice(-days);
}

export function PriceChart({
    gold,
    silver,
    source,
    defaultMetal = 'gold',
    lockMetal = false,
    title = 'Price history',
}: PriceChartProps) {
    const [activeMetal, setActiveMetal] = useState<'gold' | 'silver'>(defaultMetal);
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const { convertPrice, currency, activeCurrency } = useCurrency();

    const series = activeMetal === 'gold' ? gold : silver;

    const data = useMemo(() => {
        const sliced = downsample(sliceRange(series, timeRange));
        // Day-level labels are unreadable across years, so long ranges switch to
        // month + year.
        const isLongRange = timeRange === 'MAX' || timeRange === '1Y' || timeRange === '6M';

        return sliced.map((point) => ({
            date: point.date,
            label: new Date(point.date).toLocaleDateString(
                'en-US',
                isLongRange
                    ? { month: 'short', year: 'numeric' }
                    : { month: 'short', day: 'numeric' }
            ),
            // Fall back to the USD close when no rate is available, matching the
            // currency label rendered below.
            price: convertPrice(point.close) ?? point.close,
        }));
    }, [series, timeRange, convertPrice]);

    const color = activeMetal === 'gold' ? '#d6a93e' : '#94a3b8';
    const symbol: MetalSymbol = activeMetal === 'gold' ? 'XAU' : 'XAG';
    const hasData = data.length >= 2;

    return (
        <section className="border-y border-white/5 bg-zinc-900/30 py-12">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{title}</h2>
                        <p className="text-sm text-zinc-400">
                            Daily closing prices, {symbol}/{activeCurrency}
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 md:justify-end">
                        {!lockMetal && (
                            <div
                                role="radiogroup"
                                aria-label="Metal"
                                className="flex rounded-lg border border-white/10 bg-zinc-900 p-1"
                            >
                                {(['gold', 'silver'] as const).map((metal) => (
                                    <button
                                        key={metal}
                                        type="button"
                                        role="radio"
                                        aria-checked={activeMetal === metal}
                                        onClick={() => setActiveMetal(metal)}
                                        className={cn(
                                            'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                            activeMetal === metal
                                                ? 'bg-gold-500 text-black shadow-lg'
                                                : 'text-zinc-300 hover:text-white'
                                        )}
                                    >
                                        {metal}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div
                            role="radiogroup"
                            aria-label="Time range"
                            className="flex rounded-lg border border-white/10 bg-zinc-900 p-1"
                        >
                            {RANGES.map((range) => (
                                <button
                                    key={range}
                                    type="button"
                                    role="radio"
                                    aria-checked={timeRange === range}
                                    aria-label={range === 'MAX' ? 'All available history' : range}
                                    onClick={() => setTimeRange(range)}
                                    className={cn(
                                        'rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:px-3',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                        timeRange === range
                                            ? 'bg-zinc-700 text-white'
                                            : 'text-zinc-300 hover:text-white'
                                    )}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-[400px] w-full rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient
                                        id={`gradient-${activeMetal}`}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="#a1a1aa"
                                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <YAxis
                                    stroke="#a1a1aa"
                                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                                    tickFormatter={(value: number) => value.toLocaleString('en-US')}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['auto', 'auto']}
                                    width={80}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#18181b',
                                        border: '1px solid #3f3f46',
                                        borderRadius: '8px',
                                        color: '#fff',
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#a1a1aa' }}
                                    formatter={(value: number) => [
                                        formatMetalPrice(value, activeCurrency),
                                        'Close',
                                    ]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke={color}
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill={`url(#gradient-${activeMetal})`}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                            <p className="font-medium text-zinc-300">
                                No historical data for this range yet
                            </p>
                            <p className="max-w-md text-sm text-zinc-400">
                                Price history is collected on a schedule and will fill in as data
                                accumulates.
                            </p>
                        </div>
                    )}
                </div>

                {hasData && (
                    <p className="mt-3 text-xs text-zinc-400">
                        {data.length} daily closes
                        {source ? ` · Source: ${source}` : ''}
                        {currency !== activeCurrency
                            ? ` · ${currency} rates unavailable, showing ${activeCurrency}`
                            : ''}
                        {/* Futures settle at a small premium to spot, so the last
                            point here will not exactly match the spot price shown
                            above. Say so rather than let it look like an error. */}
                        {source?.includes('futures') && (
                            <> · Futures settle at a small premium to spot prices</>
                        )}
                    </p>
                )}
            </div>
        </section>
    );
}
