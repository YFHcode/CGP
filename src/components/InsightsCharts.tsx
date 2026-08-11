'use client';

import {
    ComposedChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

import { formatMetalPrice, formatPercent } from '@/lib/currencies';
import type { MovingAveragePoint, VolatilityPoint } from '@/lib/insights-metrics';

/**
 * Recharts-based visualizations for the insights pages.
 *
 * Colors for the moving-average pair (#2563eb / #c2410c) and the volatility
 * line (#0d9488) were run through the dataviz skill's palette validator
 * against this site's dark chart surface — CVD separation, lightness band
 * and contrast all pass. The metal's own established color (gold/slate)
 * carries the price line, unchanged.
 */

const MAX_PLOTTED_POINTS = 400;

/** Evenly thins a series, always keeping the first and last points. */
function downsample<T>(points: T[], limit = MAX_PLOTTED_POINTS): T[] {
    if (points.length <= limit) return points;
    const step = (points.length - 1) / (limit - 1);
    const thinned: T[] = [];
    for (let i = 0; i < limit; i += 1) {
        thinned.push(points[Math.round(i * step)]);
    }
    return thinned;
}

function dateLabel(iso: string, longRange: boolean): string {
    const date = new Date(iso);
    return date.toLocaleDateString(
        'en-US',
        longRange ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' }
    );
}

interface TrendChartProps {
    points: MovingAveragePoint[];
    metalColor: string;
    metalName: string;
}

/** Price with its 50-day and 200-day moving averages overlaid — one axis, one unit (USD). */
export function TrendChart({ points, metalColor, metalName }: TrendChartProps) {
    const longRange = points.length > 120;
    const data = downsample(points).map((p) => ({
        ...p,
        label: dateLabel(p.date, longRange),
    }));

    return (
        <div className="h-[400px] w-full rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
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
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(value: number, name: string) => [formatMetalPrice(value, 'USD'), name]}
                    />
                    <Legend
                        wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }}
                        formatter={(value: string) => <span style={{ color: '#e4e4e7' }}>{value}</span>}
                    />
                    <Line
                        type="monotone"
                        dataKey="close"
                        name={metalName}
                        stroke={metalColor}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="ma50"
                        name="50-day average"
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="ma200"
                        name="200-day average"
                        stroke="#c2410c"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}

interface VolatilityChartProps {
    points: VolatilityPoint[];
}

/** Rolling 30-day volatility — a single series, so identity comes from the title, not a legend. */
export function VolatilityChart({ points }: VolatilityChartProps) {
    const longRange = points.length > 120;
    const data = downsample(points).map((p) => ({
        ...p,
        label: dateLabel(p.date, longRange),
    }));

    return (
        <div className="h-[300px] w-full rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="gradient-volatility" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
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
                        tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                        tickLine={false}
                        axisLine={false}
                        width={60}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #3f3f46',
                            borderRadius: '8px',
                            color: '#fff',
                        }}
                        labelStyle={{ color: '#a1a1aa' }}
                        formatter={(value: number) => [formatPercent(value).replace('+', ''), 'Volatility']}
                    />
                    <Area
                        type="monotone"
                        dataKey="volatilityPct"
                        stroke="#0d9488"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#gradient-volatility)"
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
