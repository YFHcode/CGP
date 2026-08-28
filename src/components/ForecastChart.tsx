'use client';

import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

import type { ForecastPoint } from '@/lib/forecast';
import type { HistoryPoint } from '@/types';

/**
 * Fan chart: recent history, then the projection as a widening band.
 *
 * Drawn deliberately so the band dominates and the central line is thin and
 * dashed. That is not a stylistic choice — the backtest shows the central line
 * has no measurable skill over assuming no change, while the band is
 * well-calibrated. The chart should make the reliable part the visually
 * prominent one.
 */

interface ForecastChartProps {
    history: HistoryPoint[];
    forecast: ForecastPoint[];
    metalName: string;
    color: string;
}

interface Row {
    date: string;
    label: string;
    actual?: number;
    expected?: number;
    /** Recharts stacks these: base is transparent, span is the visible band. */
    base95?: number;
    span95?: number;
    base80?: number;
    span80?: number;
}

const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });

const money = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ForecastChart({ history, forecast, metalName, color }: ForecastChartProps) {
    const tail = history.slice(-40);

    const rows: Row[] = [
        ...tail.map((p) => ({ date: p.date, label: fmt(p.date), actual: p.close })),
        ...forecast.map((p) => ({
            date: p.date,
            label: fmt(p.date),
            expected: p.expected,
            base95: p.low95,
            span95: p.high95 - p.low95,
            base80: p.low80,
            span80: p.high80 - p.low80,
        })),
    ];

    // Join the two segments so the projection starts from the last real close
    // instead of leaving a visual gap that reads as a jump.
    const lastActual = tail[tail.length - 1];
    if (lastActual) {
        const joinIndex = tail.length - 1;
        rows[joinIndex] = {
            ...rows[joinIndex],
            expected: lastActual.close,
            base95: lastActual.close,
            span95: 0,
            base80: lastActual.close,
            span80: 0,
        };
    }

    return (
        <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        minTickGap={28}
                        tickLine={false}
                        axisLine={{ stroke: '#ffffff18' }}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fill: '#a1a1aa', fontSize: 11 }}
                        tickFormatter={(v: number) => money(v)}
                        tickLine={false}
                        axisLine={false}
                        width={68}
                    />
                    <Tooltip
                        contentStyle={{
                            background: '#09090b',
                            border: '1px solid #ffffff20',
                            borderRadius: 8,
                            fontSize: 12,
                        }}
                        labelStyle={{ color: '#e4e4e7' }}
                        formatter={(value: number, name: string) => {
                            if (name === 'span95' || name === 'span80' || name.startsWith('base'))
                                return [];
                            return [money(value), name === 'actual' ? metalName : 'Projection'];
                        }}
                    />

                    {lastActual && (
                        <ReferenceLine
                            x={fmt(lastActual.date)}
                            stroke="#ffffff35"
                            strokeDasharray="4 4"
                            label={{ value: 'today', fill: '#a1a1aa', fontSize: 10, position: 'top' }}
                        />
                    )}

                    {/* 95% band, then 80% stacked on top of its own base. */}
                    <Area dataKey="base95" stackId="a" stroke="none" fill="transparent" isAnimationActive={false} />
                    <Area
                        dataKey="span95"
                        stackId="a"
                        stroke="none"
                        fill={color}
                        fillOpacity={0.12}
                        isAnimationActive={false}
                    />
                    <Area dataKey="base80" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
                    <Area
                        dataKey="span80"
                        stackId="b"
                        stroke="none"
                        fill={color}
                        fillOpacity={0.22}
                        isAnimationActive={false}
                    />

                    <Line
                        dataKey="actual"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <Line
                        dataKey="expected"
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
