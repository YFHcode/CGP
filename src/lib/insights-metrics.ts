import type { HistoryPoint } from '@/types';
import { getPeriodStats, listPeriods, parsePeriod } from './history-periods';

/**
 * Historical analytics computed purely from the stored price series — moving
 * averages, drawdowns, rolling volatility, annual returns and monthly
 * seasonality. Every number here is derived, not fetched or hand-picked, so
 * it stays correct as the series grows without any maintenance.
 */

export interface MovingAveragePoint {
    date: string;
    close: number;
    ma50: number | null;
    ma200: number | null;
}

/**
 * Trailing simple moving averages. A point's average is null until enough
 * prior history exists to compute it honestly — padding with a partial
 * average would understate how far the price has moved from its trend.
 */
export function movingAverages(points: HistoryPoint[]): MovingAveragePoint[] {
    const windows = [50, 200] as const;
    const sums: Record<(typeof windows)[number], number> = { 50: 0, 200: 0 };

    return points.map((point, index) => {
        const result: MovingAveragePoint = {
            date: point.date,
            close: point.close,
            ma50: null,
            ma200: null,
        };

        for (const window of windows) {
            sums[window] += point.close;
            if (index >= window) sums[window] -= points[index - window].close;
            if (index >= window - 1) {
                const average = sums[window] / window;
                if (window === 50) result.ma50 = average;
                else result.ma200 = average;
            }
        }

        return result;
    });
}

export interface DrawdownPoint {
    date: string;
    /** Percent below the running peak as of this point (0 or negative). */
    pct: number;
}

export interface MaxDrawdown {
    peakDate: string;
    peakClose: number;
    troughDate: string;
    troughClose: number;
    /** Magnitude of the decline, positive (e.g. 18.4 for an 18.4% fall). */
    pct: number;
    /** First date the price closed back at or above the peak, or null if it hasn't yet. */
    recoveryDate: string | null;
}

export interface DrawdownSummary {
    series: DrawdownPoint[];
    /** The single worst peak-to-trough decline on record. */
    maxDrawdown: MaxDrawdown | null;
    /** Percent below the all-time high as of the latest point (0 or negative). */
    currentDrawdownPct: number;
    /** Days between the all-time high and the latest point. 0 if today is the high. */
    daysSinceAllTimeHigh: number;
}

function daysBetween(a: string, b: string): number {
    const msPerDay = 86_400_000;
    return Math.round(
        (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / msPerDay
    );
}

/**
 * Every point's decline from the running peak, plus the single worst
 * peak-to-trough drawdown and whether it has since recovered.
 */
export function computeDrawdowns(points: HistoryPoint[]): DrawdownSummary {
    if (points.length === 0) {
        return { series: [], maxDrawdown: null, currentDrawdownPct: 0, daysSinceAllTimeHigh: 0 };
    }

    const series: DrawdownPoint[] = [];
    let peak = points[0];

    // Tracks the drawdown currently in progress, so we can close it out and
    // compare against the worst one seen once it recovers or the series ends.
    let openDrawdown: { peak: HistoryPoint; trough: HistoryPoint } | null = null;
    let worst: MaxDrawdown | null = null;

    const closeOut = (recoveryDate: string | null) => {
        if (!openDrawdown) return;
        const pct = ((openDrawdown.peak.close - openDrawdown.trough.close) / openDrawdown.peak.close) * 100;
        if (pct > 0 && (!worst || pct > worst.pct)) {
            worst = {
                peakDate: openDrawdown.peak.date,
                peakClose: openDrawdown.peak.close,
                troughDate: openDrawdown.trough.date,
                troughClose: openDrawdown.trough.close,
                pct,
                recoveryDate,
            };
        }
        openDrawdown = null;
    };

    for (const point of points) {
        if (point.close >= peak.close) {
            closeOut(point.date);
            peak = point;
        } else {
            if (!openDrawdown || point.close < openDrawdown.trough.close) {
                openDrawdown = { peak, trough: point };
            }
        }
        series.push({
            date: point.date,
            pct: peak.close > 0 ? ((point.close - peak.close) / peak.close) * 100 : 0,
        });
    }
    closeOut(null); // still open at the end of the series — no recovery yet

    // `peak` already holds the most recent point tied for the running
    // all-time high — the loop advances it on `>=`, not just `>`, so a later
    // exact tie correctly counts as re-touching the high rather than being
    // ignored in favour of the first time it was reached.
    const latest = points[points.length - 1];

    return {
        series,
        maxDrawdown: worst,
        currentDrawdownPct: series[series.length - 1].pct,
        daysSinceAllTimeHigh: daysBetween(peak.date, latest.date),
    };
}

export interface VolatilityPoint {
    date: string;
    /** Standard deviation of daily % returns over the trailing window. */
    volatilityPct: number;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/**
 * Rolling volatility: the standard deviation of daily % returns over a
 * trailing window, recomputed at every point once enough history exists.
 */
export function rollingVolatility(points: HistoryPoint[], window = 30): VolatilityPoint[] {
    const returns: number[] = [];
    for (let i = 1; i < points.length; i += 1) {
        const previous = points[i - 1].close;
        returns.push(previous > 0 ? ((points[i].close - previous) / previous) * 100 : 0);
    }

    const result: VolatilityPoint[] = [];
    for (let i = window; i <= returns.length; i += 1) {
        result.push({
            date: points[i].date,
            volatilityPct: stdDev(returns.slice(i - window, i)),
        });
    }
    return result;
}

export interface AnnualReturn {
    year: string;
    open: number;
    close: number;
    changePct: number;
    isComplete: boolean;
}

/** Full-year % returns, newest year first. Reuses the same period maths as the archive pages. */
export function annualReturns(points: HistoryPoint[]): AnnualReturn[] {
    return listPeriods(points, 'year')
        .map((year) => {
            const period = parsePeriod(year);
            const stats = period ? getPeriodStats(points, period) : null;
            if (!stats) return null;
            return {
                year,
                open: stats.open,
                close: stats.close,
                changePct: stats.changePct,
                isComplete: stats.isComplete,
            };
        })
        .filter((entry): entry is AnnualReturn => entry !== null)
        .reverse();
}

export interface MonthlySeasonality {
    /** 1 = January .. 12 = December. */
    month: number;
    avgChangePct: number;
    /** How many complete calendar months fed into the average. */
    sampleCount: number;
}

/**
 * Average % change by calendar month across every year held, answering
 * "is this metal seasonal". The current, still-in-progress month is
 * excluded — a partial month's return isn't comparable to a full one and
 * would skew the average toward whatever the month looks like so far.
 */
export function monthlySeasonality(points: HistoryPoint[]): MonthlySeasonality[] {
    const sums = new Array(12).fill(0);
    const counts = new Array(12).fill(0);

    for (const key of listPeriods(points, 'month')) {
        const period = parsePeriod(key);
        const stats = period ? getPeriodStats(points, period) : null;
        if (!stats || !stats.isComplete) continue;

        const monthIndex = Number(key.slice(5, 7)) - 1;
        sums[monthIndex] += stats.changePct;
        counts[monthIndex] += 1;
    }

    return sums.map((sum, index) => ({
        month: index + 1,
        avgChangePct: counts[index] > 0 ? sum / counts[index] : 0,
        sampleCount: counts[index],
    }));
}
