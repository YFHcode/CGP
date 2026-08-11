'use client';

import { useMemo, useState } from 'react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { formatMetalPrice, formatPercent, formatNumber } from '@/lib/currencies';
import type { HistoryPoint } from '@/types';

/**
 * The homepage's first impression of the site's actual depth: one chart
 * widget, four different real views of the same underlying data, all
 * driven by the same time-range filter. A first-time visitor who only ever
 * saw a single price line had no reason to believe there was more here —
 * flipping between "gold vs silver", "daily change" and "ratio" is meant to
 * surface that in the first few seconds.
 *
 * Deliberately its own component rather than an extension of PriceChart:
 * PriceChart is reused across a dozen pages, so changing its shape there
 * would be a much larger blast radius for a feature that is, for now, only
 * asked for on the homepage.
 */

type ChartKind = 'price' | 'compare' | 'change' | 'ratio';
type TimeRange = '1W' | '1M' | '6M' | '1Y' | 'MAX';

const RANGE_DAYS: Record<TimeRange, number | null> = {
    '1W': 7,
    '1M': 30,
    '6M': 180,
    '1Y': 365,
    MAX: null,
};
const RANGES = Object.keys(RANGE_DAYS) as TimeRange[];

const CHART_KINDS: { key: ChartKind; label: string; needsMetal: boolean }[] = [
    { key: 'price', label: 'Price', needsMetal: true },
    { key: 'compare', label: 'Gold vs Silver', needsMetal: false },
    { key: 'change', label: 'Daily change', needsMetal: true },
    { key: 'ratio', label: 'Gold / Silver ratio', needsMetal: false },
];

const MAX_PLOTTED_POINTS = 400;
const MAX_PLOTTED_BARS = 200;

function downsample<T>(points: T[], limit: number): T[] {
    if (points.length <= limit) return points;
    const step = (points.length - 1) / (limit - 1);
    const thinned: T[] = [];
    for (let i = 0; i < limit; i += 1) {
        thinned.push(points[Math.round(i * step)]);
    }
    return thinned;
}

function sliceRange(points: HistoryPoint[], range: TimeRange): HistoryPoint[] {
    if (points.length === 0) return [];
    const days = RANGE_DAYS[range];
    if (days === null) return points;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const windowed = points.filter((point) => {
        const time = new Date(point.date).getTime();
        return Number.isFinite(time) && time >= cutoff;
    });
    return windowed.length >= 2 ? windowed : points.slice(-days);
}

function dateLabel(iso: string, longRange: boolean): string {
    return new Date(iso).toLocaleDateString(
        'en-US',
        longRange ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' }
    );
}

/** Inner-joins two series on date, so index/ratio math only ever compares real pairs. */
function joinByDate(a: HistoryPoint[], b: HistoryPoint[]): { date: string; a: number; b: number }[] {
    const bByDate = new Map(b.map((p) => [p.date, p.close]));
    const joined: { date: string; a: number; b: number }[] = [];
    for (const point of a) {
        const bClose = bByDate.get(point.date);
        if (bClose !== undefined) joined.push({ date: point.date, a: point.close, b: bClose });
    }
    return joined;
}

const GOLD_COLOR = '#d6a93e';
const SILVER_COLOR = '#94a3b8';
const RATIO_COLOR = '#0d9488';

interface ExploreChartProps {
    gold: HistoryPoint[];
    silver: HistoryPoint[];
    source?: string | null;
}

export function ExploreChart({ gold, silver, source }: ExploreChartProps) {
    const [kind, setKind] = useState<ChartKind>('price');
    const [activeMetal, setActiveMetal] = useState<'gold' | 'silver'>('gold');
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const { convertPrice, currency, activeCurrency } = useCurrency();

    const activeSeries = activeMetal === 'gold' ? gold : silver;
    const activeColor = activeMetal === 'gold' ? GOLD_COLOR : SILVER_COLOR;
    const longRange = timeRange === 'MAX' || timeRange === '1Y' || timeRange === '6M';

    const priceData = useMemo(() => {
        const sliced = downsample(sliceRange(activeSeries, timeRange), MAX_PLOTTED_POINTS);
        return sliced.map((point) => ({
            date: point.date,
            label: dateLabel(point.date, longRange),
            price: convertPrice(point.close) ?? point.close,
        }));
    }, [activeSeries, timeRange, longRange, convertPrice]);

    const compareData = useMemo(() => {
        const joined = joinByDate(sliceRange(gold, timeRange), sliceRange(silver, timeRange));
        if (joined.length === 0) return [];
        const base = joined[0];
        return downsample(joined, MAX_PLOTTED_POINTS).map((p) => ({
            date: p.date,
            label: dateLabel(p.date, longRange),
            gold: (p.a / base.a) * 100,
            silver: (p.b / base.b) * 100,
        }));
    }, [gold, silver, timeRange, longRange]);

    const ratioData = useMemo(() => {
        const joined = joinByDate(sliceRange(gold, timeRange), sliceRange(silver, timeRange));
        return downsample(joined, MAX_PLOTTED_POINTS).map((p) => ({
            date: p.date,
            label: dateLabel(p.date, longRange),
            ratio: p.b > 0 ? p.a / p.b : 0,
        }));
    }, [gold, silver, timeRange, longRange]);

    const changeData = useMemo(() => {
        const sliced = sliceRange(activeSeries, timeRange);
        if (sliced.length === 0) return [];
        const startIndex = activeSeries.findIndex((p) => p.date === sliced[0].date);
        const withLeading = startIndex > 0 ? [activeSeries[startIndex - 1], ...sliced] : sliced;

        const changes: { date: string; label: string; pct: number }[] = [];
        for (let i = 1; i < withLeading.length; i += 1) {
            const prev = withLeading[i - 1].close;
            const cur = withLeading[i].close;
            changes.push({
                date: withLeading[i].date,
                label: dateLabel(withLeading[i].date, longRange),
                pct: prev > 0 ? ((cur - prev) / prev) * 100 : 0,
            });
        }
        return downsample(changes, MAX_PLOTTED_BARS);
    }, [activeSeries, timeRange, longRange]);

    const tooltipStyle = {
        contentStyle: {
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            color: '#fff',
        },
        labelStyle: { color: '#a1a1aa' },
    };

    const axisProps = {
        stroke: '#a1a1aa',
        tick: { fill: '#a1a1aa', fontSize: 12 },
        tickLine: false,
        axisLine: false,
    };

    const activeKind = CHART_KINDS.find((c) => c.key === kind)!;
    const subtitle = {
        price: `Daily closing prices, ${activeMetal === 'gold' ? 'XAU' : 'XAG'}/${activeCurrency}`,
        compare: 'Both metals indexed to 100 at the start of the range, so relative performance is directly comparable',
        change: `Day-over-day % change, ${activeMetal === 'gold' ? 'gold' : 'silver'}`,
        ratio: 'Ounces of silver one ounce of gold buys, over time',
    }[kind];

    const hasData =
        (kind === 'price' && priceData.length >= 2) ||
        (kind === 'compare' && compareData.length >= 2) ||
        (kind === 'change' && changeData.length >= 1) ||
        (kind === 'ratio' && ratioData.length >= 2);

    return (
        <section className="border-y border-white/5 bg-zinc-900/30 py-12">
            <div className="container mx-auto px-4">
                <div className="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Explore the data</h2>
                        <p className="text-sm text-zinc-400">{subtitle}</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 md:justify-end">
                        {activeKind.needsMetal && (
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

                <div
                    role="tablist"
                    aria-label="Chart type"
                    className="mb-4 flex flex-wrap gap-2"
                >
                    {CHART_KINDS.map((entry) => (
                        <button
                            key={entry.key}
                            type="button"
                            role="tab"
                            aria-selected={kind === entry.key}
                            onClick={() => setKind(entry.key)}
                            className={cn(
                                'rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                kind === entry.key
                                    ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                                    : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
                            )}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>

                <div className="h-[400px] w-full rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
                    {!hasData ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                            <p className="font-medium text-zinc-300">No historical data for this range yet</p>
                            <p className="max-w-md text-sm text-zinc-400">
                                Price history is collected on a schedule and will fill in as data accumulates.
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            {kind === 'price' ? (
                                <AreaChart data={priceData}>
                                    <defs>
                                        <linearGradient id="explore-gradient-price" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={activeColor} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={activeColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                    <XAxis dataKey="label" {...axisProps} minTickGap={30} />
                                    <YAxis
                                        {...axisProps}
                                        tickFormatter={(v: number) => v.toLocaleString('en-US')}
                                        domain={['auto', 'auto']}
                                        width={80}
                                    />
                                    <Tooltip
                                        {...tooltipStyle}
                                        formatter={(value: number) => [formatMetalPrice(value, activeCurrency), 'Close']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="price"
                                        stroke={activeColor}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#explore-gradient-price)"
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            ) : kind === 'compare' ? (
                                <LineChart data={compareData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                    <XAxis dataKey="label" {...axisProps} minTickGap={30} />
                                    <YAxis
                                        {...axisProps}
                                        tickFormatter={(v: number) => v.toFixed(0)}
                                        domain={['auto', 'auto']}
                                        width={60}
                                    />
                                    <Tooltip
                                        {...tooltipStyle}
                                        formatter={(value: number, name: string) => [formatNumber(value, 1), name]}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: 12 }}
                                        formatter={(value: string) => <span style={{ color: '#e4e4e7' }}>{value}</span>}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="gold"
                                        name="Gold"
                                        stroke={GOLD_COLOR}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="silver"
                                        name="Silver"
                                        stroke={SILVER_COLOR}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            ) : kind === 'ratio' ? (
                                <LineChart data={ratioData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                    <XAxis dataKey="label" {...axisProps} minTickGap={30} />
                                    <YAxis
                                        {...axisProps}
                                        tickFormatter={(v: number) => v.toFixed(0)}
                                        domain={['auto', 'auto']}
                                        width={50}
                                    />
                                    <Tooltip
                                        {...tooltipStyle}
                                        formatter={(value: number) => [formatNumber(value, 1), 'Ratio']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="ratio"
                                        stroke={RATIO_COLOR}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            ) : (
                                <BarChart data={changeData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                                    <XAxis dataKey="label" {...axisProps} minTickGap={30} />
                                    <YAxis
                                        {...axisProps}
                                        tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                                        width={60}
                                    />
                                    <Tooltip
                                        {...tooltipStyle}
                                        formatter={(value: number) => [formatPercent(value), 'Change']}
                                    />
                                    <Bar dataKey="pct" isAnimationActive={false}>
                                        {changeData.map((entry) => (
                                            <Cell
                                                key={entry.date}
                                                fill={entry.pct >= 0 ? '#22c55e' : '#ef4444'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>

                {hasData && (
                    <p className="mt-3 text-xs text-zinc-400">
                        {source ? `Source: ${source}` : ''}
                        {currency !== activeCurrency && kind === 'price'
                            ? ` · ${currency} rates unavailable, showing ${activeCurrency}`
                            : ''}
                    </p>
                )}
            </div>
        </section>
    );
}
