'use client';

import {
    ComposedChart,
    LineChart,
    Line,
    Bar,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

import type { BollingerPoint, IndicatorPoint, MacdPoint } from '@/lib/indicators';

/**
 * Indicator panels for the charts pages.
 *
 * Each trims to a trailing window rather than plotting the full 26-year
 * series: an oscillator drawn across 6,500 sessions is a solid block of ink
 * that answers no question. Traders read these over months, so that is the
 * window they get.
 */

const WINDOW = 180;

const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    });

const axis = {
    tick: { fill: '#a1a1aa', fontSize: 11 },
    tickLine: false,
};

const tooltipStyle = {
    contentStyle: {
        background: '#09090b',
        border: '1px solid #ffffff20',
        borderRadius: 8,
        fontSize: 12,
    },
    labelStyle: { color: '#e4e4e7' },
};

function Panel({
    title,
    hint,
    children,
}: {
    title: string;
    hint: string;
    children: React.ReactNode;
}) {
    return (
        <section className="border-t border-white/5 py-8">
            <div className="container mx-auto px-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mb-4 max-w-3xl text-sm text-zinc-400">{hint}</p>
                <div className="h-56 w-full">{children}</div>
            </div>
        </section>
    );
}

export function RsiChart({ points }: { points: IndicatorPoint[] }) {
    const data = points
        .filter((p) => p.value !== null)
        .slice(-WINDOW)
        .map((p) => ({ label: label(p.date), rsi: p.value as number }));

    return (
        <Panel
            title="Relative Strength Index (14)"
            hint="Momentum on a 0–100 scale. Above 70 is conventionally read as overbought and below 30 as oversold — though in a strong trend a metal can sit at an extreme for weeks, which is why this is context rather than a signal."
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                    <XAxis dataKey="label" {...axis} minTickGap={40} axisLine={{ stroke: '#ffffff18' }} />
                    <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} {...axis} axisLine={false} width={36} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [v.toFixed(1), 'RSI']} />
                    <ReferenceLine y={70} stroke="#f8717155" strokeDasharray="4 4" />
                    <ReferenceLine y={30} stroke="#4ade8055" strokeDasharray="4 4" />
                    <Line dataKey="rsi" stroke="#d6a93e" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </Panel>
    );
}

export function MacdChart({ points }: { points: MacdPoint[] }) {
    const data = points
        .filter((p) => p.macd !== null && p.signal !== null)
        .slice(-WINDOW)
        .map((p) => ({
            label: label(p.date),
            macd: p.macd as number,
            signal: p.signal as number,
            histogram: p.histogram as number,
        }));

    return (
        <Panel
            title="MACD (12, 26, 9)"
            hint="The gap between a fast and a slow moving average, with its own average as a signal line. The bars are the difference between the two: crossings of the zero line mark where short-term momentum flips relative to the longer trend."
        >
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                    <XAxis dataKey="label" {...axis} minTickGap={40} axisLine={{ stroke: '#ffffff18' }} />
                    <YAxis {...axis} axisLine={false} width={52} tickFormatter={(v: number) => v.toFixed(0)} />
                    <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [v.toFixed(2), n]} />
                    <ReferenceLine y={0} stroke="#ffffff30" />
                    <Bar dataKey="histogram" fill="#7dd3fc55" isAnimationActive={false} />
                    <Line dataKey="macd" stroke="#d6a93e" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line dataKey="signal" stroke="#c4b5fd" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </Panel>
    );
}

export function BollingerChart({
    points,
    closes,
}: {
    points: BollingerPoint[];
    closes: { date: string; close: number }[];
}) {
    const closeByDate = new Map(closes.map((c) => [c.date, c.close]));
    const data = points
        .filter((p) => p.middle !== null)
        .slice(-WINDOW)
        .map((p) => ({
            label: label(p.date),
            close: closeByDate.get(p.date) ?? null,
            lower: p.lower as number,
            // Stacked so the shaded region is the band itself, not the area
            // under the upper line.
            band: (p.upper as number) - (p.lower as number),
            middle: p.middle as number,
        }));

    return (
        <Panel
            title="Bollinger Bands (20, 2)"
            hint="A 20-day average with bands two standard deviations either side. The band width is a volatility reading in itself — it contracts in quiet markets and expands sharply when a move begins."
        >
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                    <XAxis dataKey="label" {...axis} minTickGap={40} axisLine={{ stroke: '#ffffff18' }} />
                    <YAxis domain={['auto', 'auto']} {...axis} axisLine={false} width={62} />
                    <Tooltip
                        {...tooltipStyle}
                        formatter={(v: number, n: string) =>
                            n === 'band' ? [] : [`$${v.toFixed(0)}`, n]
                        }
                    />
                    <Area dataKey="lower" stackId="bb" stroke="none" fill="transparent" isAnimationActive={false} />
                    <Area dataKey="band" stackId="bb" stroke="none" fill="#d6a93e" fillOpacity={0.13} isAnimationActive={false} />
                    <Line dataKey="middle" stroke="#a1a1aa" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                    <Line dataKey="close" stroke="#d6a93e" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </Panel>
    );
}

export function RatioChart({ points }: { points: IndicatorPoint[] }) {
    // The ratio's interest is long-run, so this one keeps the full record and
    // downsamples instead of trimming to six months.
    const all = points.filter((p) => p.value !== null);
    const step = Math.max(1, Math.ceil(all.length / 400));
    const data = all
        .filter((_, i) => i % step === 0)
        .map((p) => ({ label: label(p.date), ratio: p.value as number }));

    const values = all.map((p) => p.value as number);
    const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);

    return (
        <Panel
            title="Gold-to-silver ratio, full record"
            hint="How many ounces of silver one ounce of gold buys. Traders watch it for relative value rather than direction — a high ratio has historically meant silver is cheap against gold, not that either is cheap outright."
        >
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                    <XAxis dataKey="label" {...axis} minTickGap={50} axisLine={{ stroke: '#ffffff18' }} />
                    <YAxis domain={['auto', 'auto']} {...axis} axisLine={false} width={40} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [v.toFixed(1), 'Ratio']} />
                    <ReferenceLine
                        y={mean}
                        stroke="#ffffff35"
                        strokeDasharray="4 4"
                        label={{ value: `avg ${mean.toFixed(0)}`, fill: '#a1a1aa', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <Line dataKey="ratio" stroke="#94a3b8" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </Panel>
    );
}
