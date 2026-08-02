import type { HistoryPoint, MetalSymbol } from '@/types';

/**
 * Period pages are generated from our own accumulated price history, so every
 * figure on them is first-party data rather than republished third-party
 * content.
 */

export type PeriodKind = 'year' | 'month' | 'day';

export interface Period {
    kind: PeriodKind;
    /** Canonical slug, e.g. "2026", "2026-08", "2026-08-02". */
    slug: string;
    /** Inclusive ISO date bounds. */
    start: string;
    end: string;
    /** Human label, e.g. "August 2026". */
    label: string;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const YEAR_RE = /^(\d{4})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function lastDayOfMonth(year: number, month: number): number {
    // Day 0 of the next month is the last day of this one.
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidMonth(month: number) {
    return month >= 1 && month <= 12;
}

/** Parses a URL slug into a period, or null when it isn't a valid one. */
export function parsePeriod(slug: string): Period | null {
    if (typeof slug !== 'string') return null;

    const year = YEAR_RE.exec(slug);
    if (year) {
        const y = Number(year[1]);
        if (y < 1900 || y > 2200) return null;
        return {
            kind: 'year',
            slug,
            start: `${year[1]}-01-01`,
            end: `${year[1]}-12-31`,
            label: year[1],
        };
    }

    const month = MONTH_RE.exec(slug);
    if (month) {
        const y = Number(month[1]);
        const m = Number(month[2]);
        if (!isValidMonth(m) || y < 1900 || y > 2200) return null;
        const last = String(lastDayOfMonth(y, m)).padStart(2, '0');
        return {
            kind: 'month',
            slug,
            start: `${month[1]}-${month[2]}-01`,
            end: `${month[1]}-${month[2]}-${last}`,
            label: `${MONTH_NAMES[m - 1]} ${month[1]}`,
        };
    }

    const day = DAY_RE.exec(slug);
    if (day) {
        const y = Number(day[1]);
        const m = Number(day[2]);
        const d = Number(day[3]);
        if (!isValidMonth(m) || d < 1 || d > lastDayOfMonth(y, m)) return null;
        return {
            kind: 'day',
            slug,
            start: slug,
            end: slug,
            label: `${d} ${MONTH_NAMES[m - 1]} ${day[1]}`,
        };
    }

    return null;
}

export interface PeriodStats {
    period: Period;
    /** Points falling inside the period, ascending. */
    points: HistoryPoint[];
    /** First and last close within the period. */
    open: number;
    close: number;
    high: number;
    low: number;
    average: number;
    /** Change across the period, measured from the last close before it. */
    change: number;
    changePct: number;
    /** Last close before the period started, or null if none exists. */
    previousClose: number | null;
    /** Dates of the extremes, for the copy. */
    highDate: string;
    lowDate: string;
}

/**
 * Computes summary statistics for a period.
 * Returns null when the period holds no data, so callers can 404 rather than
 * publish an empty page.
 */
export function getPeriodStats(points: HistoryPoint[], period: Period): PeriodStats | null {
    const inRange = points.filter((p) => p.date >= period.start && p.date <= period.end);
    if (inRange.length === 0) return null;

    const closes = inRange.map((p) => p.close);
    const open = closes[0];
    const close = closes[closes.length - 1];

    let high = inRange[0];
    let low = inRange[0];
    for (const point of inRange) {
        if (point.close > high.close) high = point;
        if (point.close < low.close) low = point;
    }

    const average = closes.reduce((sum, c) => sum + c, 0) / closes.length;

    // Measure from the previous close so a single-day period still shows a
    // meaningful change rather than zero.
    const before = points.filter((p) => p.date < period.start);
    const previousClose = before.length > 0 ? before[before.length - 1].close : null;

    const baseline = previousClose ?? open;
    const change = close - baseline;
    const changePct = baseline !== 0 ? (change / baseline) * 100 : 0;

    return {
        period,
        points: inRange,
        open,
        close,
        high: high.close,
        low: low.close,
        highDate: high.date,
        lowDate: low.date,
        average,
        change,
        changePct,
        previousClose,
    };
}

/** Every period slug of a given kind that has at least one data point. */
export function listPeriods(points: HistoryPoint[], kind: PeriodKind): string[] {
    const seen = new Set<string>();

    for (const point of points) {
        if (!DAY_RE.test(point.date)) continue;
        if (kind === 'year') seen.add(point.date.slice(0, 4));
        else if (kind === 'month') seen.add(point.date.slice(0, 7));
        else seen.add(point.date);
    }

    return [...seen].sort();
}

/** The period slugs immediately before and after this one that hold data. */
export function adjacentPeriods(
    points: HistoryPoint[],
    period: Period
): { previous: string | null; next: string | null } {
    const all = listPeriods(points, period.kind);
    const index = all.indexOf(period.slug);
    if (index === -1) return { previous: null, next: null };

    return {
        previous: index > 0 ? all[index - 1] : null,
        next: index < all.length - 1 ? all[index + 1] : null,
    };
}

/** The parent period slug: a day rolls up to its month, a month to its year. */
export function parentPeriod(period: Period): string | null {
    if (period.kind === 'day') return period.slug.slice(0, 7);
    if (period.kind === 'month') return period.slug.slice(0, 4);
    return null;
}

export const METAL_ROUTES: Record<MetalSymbol, { base: string; name: string }> = {
    XAU: { base: '/gold-price', name: 'Gold' },
    XAG: { base: '/silver-price', name: 'Silver' },
};
