import type { HistoryPoint, MetalSymbol } from '@/types';

/**
 * Period pages are generated from our own accumulated price history, so every
 * figure on them is first-party data rather than republished third-party
 * content.
 */

export type PeriodKind = 'year' | 'month' | 'day';

export interface Period {
    kind: PeriodKind;
    /** ISO key used internally for sorting and lookups: "2026-08-02". */
    key: string;
    /**
     * Canonical URL slug: "2026", "august-2026", "2-august-2026".
     *
     * Readable rather than ISO because the URL shows in search results. The
     * parent segment already supplies the keyword (/gold-price/...), so the
     * slug does not repeat it — "gold-price/gold-price-on-2-august-2026" is
     * redundant, and the price is deliberately not in the URL: it is data, not
     * identity, and would break every link if a figure were ever corrected.
     */
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

/** Readable forms: "august-2026" and "2-august-2026". */
const MONTH_NAME_RE = /^([a-z]+)-(\d{4})$/i;
const DAY_NAME_RE = /^(\d{1,2})-([a-z]+)-(\d{4})$/i;

const MONTH_SLUGS = MONTH_NAMES.map((m) => m.toLowerCase());

function monthNumberFromName(name: string): number {
    return MONTH_SLUGS.indexOf(name.toLowerCase()) + 1; // 0 when unknown
}

/** Builds the canonical URL slug for an ISO key. */
export function slugForKey(key: string, kind: PeriodKind): string {
    if (kind === 'year') return key;

    const [y, m, d] = key.split('-');
    const monthName = MONTH_SLUGS[Number(m) - 1];
    if (!monthName) return key;

    return kind === 'month' ? `${monthName}-${y}` : `${Number(d)}-${monthName}-${y}`;
}

function lastDayOfMonth(year: number, month: number): number {
    // Day 0 of the next month is the last day of this one.
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidMonth(month: number) {
    return month >= 1 && month <= 12;
}

function buildPeriod(kind: PeriodKind, y: number, m: number, d: number): Period | null {
    if (y < 1900 || y > 2200) return null;

    if (kind === 'year') {
        const key = String(y);
        return { kind, key, slug: key, start: `${key}-01-01`, end: `${key}-12-31`, label: key };
    }

    if (!isValidMonth(m)) return null;
    const mm = String(m).padStart(2, '0');

    if (kind === 'month') {
        const key = `${y}-${mm}`;
        const last = String(lastDayOfMonth(y, m)).padStart(2, '0');
        return {
            kind,
            key,
            slug: slugForKey(key, 'month'),
            start: `${key}-01`,
            end: `${key}-${last}`,
            label: `${MONTH_NAMES[m - 1]} ${y}`,
        };
    }

    if (d < 1 || d > lastDayOfMonth(y, m)) return null;
    const key = `${y}-${mm}-${String(d).padStart(2, '0')}`;
    return {
        kind: 'day',
        key,
        slug: slugForKey(key, 'day'),
        start: key,
        end: key,
        label: `${d} ${MONTH_NAMES[m - 1]} ${y}`,
    };
}

/**
 * Parses a URL slug into a period, or null when it isn't a valid one.
 *
 * Accepts both the canonical readable form ("2-august-2026") and the ISO form
 * ("2026-08-02"). ISO is still parsed so URLs indexed under the old scheme keep
 * resolving; the page redirects them to the canonical slug rather than serving
 * the same content at two addresses.
 */
export function parsePeriod(slug: string): Period | null {
    if (typeof slug !== 'string') return null;

    const year = YEAR_RE.exec(slug);
    if (year) return buildPeriod('year', Number(year[1]), 0, 0);

    const isoMonth = MONTH_RE.exec(slug);
    if (isoMonth) return buildPeriod('month', Number(isoMonth[1]), Number(isoMonth[2]), 0);

    const isoDay = DAY_RE.exec(slug);
    if (isoDay) {
        return buildPeriod('day', Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]));
    }

    const namedMonth = MONTH_NAME_RE.exec(slug);
    if (namedMonth) {
        const m = monthNumberFromName(namedMonth[1]);
        if (m === 0) return null;
        return buildPeriod('month', Number(namedMonth[2]), m, 0);
    }

    const namedDay = DAY_NAME_RE.exec(slug);
    if (namedDay) {
        const m = monthNumberFromName(namedDay[2]);
        if (m === 0) return null;
        return buildPeriod('day', Number(namedDay[3]), m, Number(namedDay[1]));
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
): { previous: Period | null; next: Period | null } {
    const all = listPeriods(points, period.kind);
    const index = all.indexOf(period.key);
    if (index === -1) return { previous: null, next: null };

    return {
        previous: index > 0 ? parsePeriod(all[index - 1]) : null,
        next: index < all.length - 1 ? parsePeriod(all[index + 1]) : null,
    };
}

/** The parent period: a day rolls up to its month, a month to its year. */
export function parentPeriod(period: Period): Period | null {
    if (period.kind === 'day') return parsePeriod(period.key.slice(0, 7));
    if (period.kind === 'month') return parsePeriod(period.key.slice(0, 4));
    return null;
}

export const METAL_ROUTES: Record<MetalSymbol, { base: string; name: string }> = {
    XAU: { base: '/gold-price', name: 'Gold' },
    XAG: { base: '/silver-price', name: 'Silver' },
};
