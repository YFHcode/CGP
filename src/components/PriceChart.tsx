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
import {
    RANGE_DAYS,
    RANGES,
    downsample,
    needsFullHistory,
    sliceRange,
    type TimeRange,
} from '@/lib/chart-window';
import { useFullHistory, type HistoryMetal } from '@/lib/use-full-history';
import type { AnyMetalSymbol, HistoryPoint } from '@/types';

interface PriceChartCommonProps {
    /** Attribution for the series, shown under the chart. */
    source?: string | null;
    title?: string;
}

export type ChartMetal = 'gold' | 'silver' | 'platinum' | 'palladium';

/**
 * Line colour and ticker per metal, kept in one place so the chart can't end
 * up drawing a metal it has no label for. Platinum and palladium get cool
 * tones distinct from each other and from silver's grey.
 */
const CHART_METALS: Record<ChartMetal, { color: string; symbol: AnyMetalSymbol }> = {
    gold: { color: '#d6a93e', symbol: 'XAU' },
    silver: { color: '#94a3b8', symbol: 'XAG' },
    platinum: { color: '#7dd3fc', symbol: 'XPT' },
    palladium: { color: '#c4b5fd', symbol: 'XPD' },
};

type PriceChartProps = PriceChartCommonProps &
    (
        | {
              /** Both metals available; the switcher lets visitors flip between them. */
              lockMetal?: false;
              gold: HistoryPoint[];
              silver: HistoryPoint[];
              /** Which metal to show first. */
              defaultMetal?: 'gold' | 'silver';
              /**
               * `gold` and `silver` hold only the recent tail; fetch the full
               * record of whichever is showing for 5Y, 10Y and MAX. Set via
               * rangeChartPair() in src/lib/chart-window.ts.
               */
              fullHistory?: boolean;
          }
        | {
              /**
               * Single-metal pages. Only `series` is ever plotted, so this is
               * also what keeps the other metal's history out of the page's
               * serialized payload — there is no `gold`/`silver` pair to
               * accidentally pass both halves of.
               */
              lockMetal: true;
              /**
               * Platinum and palladium are only ever locked — there is no
               * four-way switcher, because the comparison the switcher exists
               * for is gold against silver.
               */
              metal: ChartMetal;
              series: HistoryPoint[];
              /**
               * `series` holds only the recent tail; fetch this metal's full
               * record for 5Y, 10Y and MAX. Set via rangeChartSeries() in
               * src/lib/chart-window.ts. Absent when `series` is complete — an
               * archive page's own period — and nothing is ever fetched.
               */
              fullHistory?: HistoryMetal;
          }
    );

export function PriceChart(props: PriceChartProps) {
    const { source, title = 'Price history' } = props;
    const lockMetal = props.lockMetal ?? false;

    const [activeMetal, setActiveMetal] = useState<ChartMetal>(
        props.lockMetal ? props.metal : props.defaultMetal ?? 'gold'
    );
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const { convertPrice, currency, activeCurrency } = useCurrency();

    const recent = props.lockMetal ? props.series : activeMetal === 'gold' ? props.gold : props.silver;

    // Only the ranges past a year need more than the page shipped. Once the
    // full record has arrived it is used for every range: it is a superset of
    // the tail, so the short ranges draw exactly as they did before.
    const fullMetal: HistoryMetal | undefined = props.lockMetal
        ? props.fullHistory
        : props.fullHistory
          ? activeMetal === 'silver' ? 'silver' : 'gold'
          : undefined;
    const wantsFull = fullMetal !== undefined && needsFullHistory(RANGE_DAYS[timeRange]);
    const { points: full, status } = useFullHistory(fullMetal, wantsFull);
    const series = full ?? recent;

    // Drawing the tail under a "MAX" label while the rest loads would show
    // seventeen months as if it were the whole record. Hold the chart instead;
    // on failure, draw what we have and say so below.
    const waiting = wantsFull && full === null && status !== 'failed';
    const partial = wantsFull && status === 'failed';

    const data = useMemo(() => {
        const sliced = downsample(sliceRange(series, timeRange));
        // Day-level labels are unreadable across years, so ranges of a year
        // or more switch to month + year. Derived from the window rather than
        // an explicit list, so adding a range can't silently leave day-level
        // labels on a multi-year axis. The threshold is a year, not six
        // months: at 6M, month+year repeats each month across several ticks
        // ("Mar 2026, Mar 2026, Apr 2026...").
        const days = RANGE_DAYS[timeRange];
        const isLongRange = days === null || days >= 365;

        return sliced.map((point) => ({
            date: point.date,
            // timeZone: 'UTC' — a stored date is a calendar date, not an
            // instant. Formatting it in the viewer's zone renders the day
            // before for anyone west of UTC, mislabelling every close.
            label: new Date(point.date).toLocaleDateString(
                'en-US',
                isLongRange
                    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
                    : { month: 'short', day: 'numeric', timeZone: 'UTC' }
            ),
            // Fall back to the USD close when no rate is available, matching the
            // currency label rendered below.
            price: convertPrice(point.close) ?? point.close,
        }));
    }, [series, timeRange, convertPrice]);

    const { color, symbol } = CHART_METALS[activeMetal];
    const hasData = data.length >= 2;

    return (
        <section className="border-y border-white/5 bg-zinc-900/30 py-12">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
                    <div>
                        <h2 className="text-2xl font-bold text-white">{title}</h2>
                        <p className="text-sm text-zinc-400">
                            Closing prices, {symbol}/{activeCurrency}
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
                    {waiting ? (
                        <div
                            role="status"
                            className="flex h-full items-center justify-center text-sm text-zinc-400"
                        >
                            Loading the full price record…
                        </div>
                    ) : hasData ? (
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

                {hasData && !waiting && (
                    <p className="mt-3 text-xs text-zinc-400">
                        {/* "closes", not "daily closes": the long ranges reach
                            back into the monthly portion of the record. */}
                        {data.length} closes
                        {partial && ' · Full record unavailable, showing recent history'}
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
