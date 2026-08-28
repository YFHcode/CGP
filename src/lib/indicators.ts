import type { HistoryPoint } from '@/types';

/**
 * Technical indicators computable from daily closes alone.
 *
 * The stored series carries date and close only — no open, high, low or
 * volume — which rules out anything needing intraday range (ATR, stochastics,
 * VWAP, candlestick patterns). What remains is still the set most traders
 * actually look at first, and computing them from a 26-year daily record is
 * something few free sites offer.
 *
 * Each follows its published definition rather than a convenient
 * approximation. RSI in particular uses Wilder's smoothing, not a simple
 * moving average of gains and losses: the two diverge materially, and a chart
 * labelled "RSI(14)" that uses the wrong one is wrong, not a variant.
 */

export interface IndicatorPoint {
    date: string;
    value: number | null;
}

export interface BollingerPoint {
    date: string;
    middle: number | null;
    upper: number | null;
    lower: number | null;
    /** Where price sits in the band: 0 at the lower, 1 at the upper. */
    percentB: number | null;
}

export interface MacdPoint {
    date: string;
    macd: number | null;
    signal: number | null;
    histogram: number | null;
}

/** Exponential moving average over raw values, seeded with a simple average. */
export function ema(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = new Array(values.length).fill(null);
    if (period <= 0 || values.length < period) return out;

    const k = 2 / (period + 1);
    let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    out[period - 1] = prev;

    for (let i = period; i < values.length; i++) {
        prev = values[i] * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

/**
 * Relative Strength Index, Wilder (1978).
 *
 * The first average gain/loss is a simple mean of the first `period` changes;
 * every subsequent one is smoothed as (prev * (period - 1) + current) / period.
 * That smoothing — not a rolling simple average — is what makes this RSI.
 */
export function rsi(points: HistoryPoint[], period = 14): IndicatorPoint[] {
    const out: IndicatorPoint[] = points.map((p) => ({ date: p.date, value: null }));
    if (points.length <= period) return out;

    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
        const change = points[i].close - points[i - 1].close;
        if (change >= 0) gainSum += change;
        else lossSum -= change;
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;

    const toRsi = (gain: number, loss: number) =>
        // An unbroken run of gains gives no losses to divide by; RSI is 100 by
        // definition there rather than undefined.
        loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

    out[period].value = toRsi(avgGain, avgLoss);

    for (let i = period + 1; i < points.length; i++) {
        const change = points[i].close - points[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        out[i].value = toRsi(avgGain, avgLoss);
    }

    return out;
}

/** MACD: the 12/26 EMA spread, with a 9-period EMA signal line. */
export function macd(
    points: HistoryPoint[],
    fast = 12,
    slow = 26,
    signalPeriod = 9
): MacdPoint[] {
    const closes = points.map((p) => p.close);
    const fastEma = ema(closes, fast);
    const slowEma = ema(closes, slow);

    const line: (number | null)[] = closes.map((_, i) =>
        fastEma[i] !== null && slowEma[i] !== null ? (fastEma[i] as number) - (slowEma[i] as number) : null
    );

    // The signal EMA must be seeded from where the MACD line actually starts,
    // not from index 0 — feeding it leading nulls as zeroes would drag the
    // first signal values toward zero and mistime every early crossover.
    const firstIndex = line.findIndex((v) => v !== null);
    const signal: (number | null)[] = new Array(closes.length).fill(null);
    if (firstIndex >= 0) {
        const dense = line.slice(firstIndex) as number[];
        const signalDense = ema(dense, signalPeriod);
        for (let i = 0; i < signalDense.length; i++) signal[firstIndex + i] = signalDense[i];
    }

    return points.map((p, i) => ({
        date: p.date,
        macd: line[i],
        signal: signal[i],
        histogram:
            line[i] !== null && signal[i] !== null ? (line[i] as number) - (signal[i] as number) : null,
    }));
}

/**
 * Bollinger Bands: a simple moving average with bands at a multiple of the
 * rolling standard deviation.
 *
 * Population standard deviation, matching Bollinger's own definition — the
 * sample form (n-1) is the more common statistical default and gives slightly
 * wider bands, which would not match any other chart the reader compares this
 * against.
 */
export function bollinger(points: HistoryPoint[], period = 20, multiplier = 2): BollingerPoint[] {
    const out: BollingerPoint[] = points.map((p) => ({
        date: p.date,
        middle: null,
        upper: null,
        lower: null,
        percentB: null,
    }));

    for (let i = period - 1; i < points.length; i++) {
        const window = points.slice(i - period + 1, i + 1).map((p) => p.close);
        const mean = window.reduce((a, b) => a + b, 0) / period;
        const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
        const sd = Math.sqrt(variance);

        const upper = mean + multiplier * sd;
        const lower = mean - multiplier * sd;
        out[i] = {
            date: points[i].date,
            middle: mean,
            upper,
            lower,
            percentB: upper === lower ? null : (points[i].close - lower) / (upper - lower),
        };
    }

    return out;
}

/**
 * Gold-to-silver ratio over time, aligned on shared dates.
 *
 * Aligned by date rather than by index: the two series can differ in length or
 * miss different sessions, and zipping them positionally would silently
 * compare a gold close with a silver close from another day.
 */
export function goldSilverRatio(
    gold: HistoryPoint[],
    silver: HistoryPoint[]
): IndicatorPoint[] {
    const silverByDate = new Map(silver.map((p) => [p.date, p.close]));
    const out: IndicatorPoint[] = [];

    for (const point of gold) {
        const counterpart = silverByDate.get(point.date);
        if (counterpart === undefined || !(counterpart > 0) || !(point.close > 0)) continue;
        out.push({ date: point.date, value: point.close / counterpart });
    }

    return out;
}

/** Latest non-null value of an indicator series, for summary display. */
export function latest<T extends { value: number | null }>(series: T[]): number | null {
    for (let i = series.length - 1; i >= 0; i--) {
        if (series[i].value !== null) return series[i].value;
    }
    return null;
}
