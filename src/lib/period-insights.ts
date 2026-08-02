import type { HistoryPoint } from '@/types';
import type { PeriodStats } from './history-periods';
import { GRAMS_PER_OZ, GRAMS_PER_KG, KARATS, KARAT_PURITY } from './conversions';

/**
 * Deeper statistics for the pages that are actually indexable.
 *
 * Everything here is computed from the stored series, so each page carries
 * substantive, page-specific figures rather than the same shell around one
 * number. That is what makes a bulk-generated page worth indexing — and it
 * covers long-tail phrasings ("gold to silver ratio in 2025", "14k gold price
 * per gram in March 2026") that the headline close alone never would.
 */

export interface PeriodInsights {
    /** Sessions that closed higher / lower than the one before. */
    upDays: number;
    downDays: number;
    flatDays: number;
    /** Largest single-session gain and loss inside the period. */
    bestDay: { date: string; pct: number } | null;
    worstDay: { date: string; pct: number } | null;
    /** Peak-to-trough spread as a percentage of the low. */
    rangePct: number;
    /** Standard deviation of daily percentage returns — a plain volatility read. */
    volatilityPct: number;
    /** Price per gram and per kilogram at the period close. */
    perGram: number;
    perKilo: number;
    /** Melt value per gram at each karat, at the period close. */
    perGramByKarat: { karat: string; purity: number; value: number }[];
    /** Gold-to-silver ratio at the close, and averaged across the period. */
    ratioClose: number | null;
    ratioAverage: number | null;
    /** The same period one year earlier, when we hold it. */
    yearAgoClose: number | null;
    yearAgoChangePct: number | null;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

/** Closes indexed by date, for O(1) lookups across the full series. */
function indexByDate(points: HistoryPoint[]): Map<string, number> {
    return new Map(points.map((p) => [p.date, p.close]));
}

/**
 * Finds the close on or immediately before a target date, so a comparison
 * against a weekend or holiday still resolves to a real session.
 */
function closeOnOrBefore(points: HistoryPoint[], target: string): number | null {
    let found: number | null = null;
    for (const point of points) {
        if (point.date <= target) found = point.close;
        else break;
    }
    return found;
}

export function computeInsights(
    stats: PeriodStats,
    fullSeries: HistoryPoint[],
    otherSeries: HistoryPoint[],
    metal: 'XAU' | 'XAG'
): PeriodInsights {
    const points = stats.points;

    // --- Session direction counts, measured against the prior close --------
    const returns: number[] = [];
    let upDays = 0;
    let downDays = 0;
    let flatDays = 0;
    let bestDay: { date: string; pct: number } | null = null;
    let worstDay: { date: string; pct: number } | null = null;

    let previous = stats.previousClose;
    for (const point of points) {
        if (previous !== null && previous > 0) {
            const pct = ((point.close - previous) / previous) * 100;
            returns.push(pct);

            if (pct > 0) upDays += 1;
            else if (pct < 0) downDays += 1;
            else flatDays += 1;

            if (!bestDay || pct > bestDay.pct) bestDay = { date: point.date, pct };
            if (!worstDay || pct < worstDay.pct) worstDay = { date: point.date, pct };
        }
        previous = point.close;
    }

    // --- Ratio against the other metal -------------------------------------
    const otherByDate = indexByDate(otherSeries);
    const ratios: number[] = [];
    for (const point of points) {
        const other = otherByDate.get(point.date);
        if (!other || other <= 0 || point.close <= 0) continue;
        // Always gold-over-silver, whichever page we are on.
        ratios.push(metal === 'XAU' ? point.close / other : other / point.close);
    }

    const lastOther = otherByDate.get(points[points.length - 1].date);
    const ratioClose =
        lastOther && lastOther > 0
            ? metal === 'XAU'
                ? stats.close / lastOther
                : lastOther / stats.close
            : null;

    // --- Same period a year earlier ----------------------------------------
    const endDate = stats.period.end;
    const [y, m, d] = endDate.split('-');
    const yearAgoTarget = `${Number(y) - 1}-${m}-${d}`;
    const yearAgoClose = closeOnOrBefore(fullSeries, yearAgoTarget);

    return {
        upDays,
        downDays,
        flatDays,
        bestDay,
        worstDay,
        rangePct: stats.low > 0 ? ((stats.high - stats.low) / stats.low) * 100 : 0,
        volatilityPct: stdDev(returns),
        perGram: stats.close / GRAMS_PER_OZ,
        perKilo: (stats.close / GRAMS_PER_OZ) * GRAMS_PER_KG,
        perGramByKarat: KARATS.map((karat) => ({
            karat,
            purity: KARAT_PURITY[karat],
            value: (stats.close / GRAMS_PER_OZ) * KARAT_PURITY[karat],
        })),
        ratioClose,
        ratioAverage:
            ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : null,
        yearAgoClose,
        yearAgoChangePct:
            yearAgoClose && yearAgoClose > 0
                ? ((stats.close - yearAgoClose) / yearAgoClose) * 100
                : null,
    };
}
