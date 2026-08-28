import type { HistoryPoint } from '@/types';

/**
 * Multi-horizon performance and series extremes, computed from the daily
 * closes this project already stores.
 *
 * Every competitor worth comparing against leads with a table like this — 1
 * day through 10 years and all time — and it was the largest gap in what we
 * publish. Nothing here needs a new data source: it is arithmetic over the
 * same series that drives the charts.
 *
 * The awkward part is that our series is not evenly spaced. Weekends and
 * holidays leave two- and three-day gaps everywhere, and the backfilled years
 * before 2024 carry occasional holes of up to about four weeks. So an anchor
 * date is a request, not a guarantee: we take the last close at or before the
 * date we wanted, refuse the row outright if the nearest one is too far off,
 * and report the date we actually used so the number can be checked rather
 * than trusted.
 */

export interface HorizonReturn {
    /** Stable identifier, e.g. '1y'. */
    key: string;
    /** Human label, e.g. '1 year'. */
    label: string;
    changePct: number;
    changeAbs: number;
    /** The close this change is measured from, and the date it actually fell on. */
    fromDate: string;
    fromClose: number;
    toDate: string;
    toClose: number;
    /**
     * How many calendar days earlier than requested the anchor turned out to
     * be. Zero on a clean hit. Surfaced so a "1 year" row measured from 372
     * days ago can say so instead of quietly rounding.
     */
    anchorDriftDays: number;
}

interface HorizonSpec {
    key: string;
    label: string;
    days: number;
}

/**
 * Calendar-day horizons, matching how these tables are read elsewhere: "6
 * months" means half a year ago, not 126 trading sessions ago.
 */
const HORIZONS: HorizonSpec[] = [
    { key: '1w', label: '1 week', days: 7 },
    { key: '1m', label: '1 month', days: 30 },
    { key: '6m', label: '6 months', days: 182 },
    { key: '1y', label: '1 year', days: 365 },
    { key: '5y', label: '5 years', days: 1826 },
    { key: '10y', label: '10 years', days: 3653 },
];

/**
 * How far before the requested date an anchor may fall before the row is
 * dropped as unrepresentative.
 *
 * Four days covers a weekend plus a public holiday, which is the only gap the
 * dense post-2024 era produces — so the short horizons stay honest. The 2%
 * term takes over for the multi-year horizons, whose anchors land in the
 * backfilled era where gaps reach about four weeks: 37 days of slack on a
 * five-year measurement shifts the result by a rounding error, while refusing
 * it entirely would drop the row on every metal.
 */
export function maxAnchorDrift(horizonDays: number): number {
    return Math.max(4, Math.ceil(horizonDays * 0.02));
}

function toUtc(iso: string): number {
    return Date.parse(`${iso}T00:00:00Z`);
}

function daysBetween(earlier: string, later: string): number {
    return Math.round((toUtc(later) - toUtc(earlier)) / 86_400_000);
}

function shiftDays(iso: string, delta: number): string {
    return new Date(toUtc(iso) + delta * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Index of the last point dated at or before `target`, or -1 if the series
 * starts after it. Binary search: this runs once per horizon per metal per
 * page, over six thousand points.
 */
export function indexOnOrBefore(points: HistoryPoint[], target: string): number {
    let low = 0;
    let high = points.length - 1;
    let found = -1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (points[mid].date <= target) {
            found = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return found;
}

function buildReturn(
    spec: { key: string; label: string },
    from: HistoryPoint,
    to: HistoryPoint,
    drift: number
): HorizonReturn | null {
    if (!(from.close > 0) || !Number.isFinite(to.close)) return null;
    return {
        key: spec.key,
        label: spec.label,
        changeAbs: to.close - from.close,
        changePct: ((to.close - from.close) / from.close) * 100,
        fromDate: from.date,
        fromClose: from.close,
        toDate: to.date,
        toClose: to.close,
        anchorDriftDays: drift,
    };
}

/**
 * Performance over every horizon the series can actually support.
 *
 * Horizons the data does not reach are omitted rather than rendered empty, so
 * a metal with a shorter record simply shows a shorter table instead of a row
 * of dashes.
 */
export function horizonReturns(points: HistoryPoint[]): HorizonReturn[] {
    if (points.length < 2) return [];

    const latest = points[points.length - 1];
    const rows: HorizonReturn[] = [];

    // 1 day is the previous session, not a calendar day back: over a weekend
    // "yesterday's close" is Friday's, and every quote page in the world
    // means that by it.
    const previous = points[points.length - 2];
    const oneDay = buildReturn(
        { key: '1d', label: '1 day' },
        previous,
        latest,
        Math.max(0, daysBetween(previous.date, latest.date) - 1)
    );
    if (oneDay) rows.push(oneDay);

    for (const spec of HORIZONS) {
        const target = shiftDays(latest.date, -spec.days);
        const index = indexOnOrBefore(points, target);
        if (index < 0) continue;
        const anchor = points[index];
        const drift = daysBetween(anchor.date, target);
        if (drift > maxAnchorDrift(spec.days)) continue;
        const row = buildReturn(spec, anchor, latest, drift);
        if (row) rows.push(row);
    }

    // Year to date, anchored on the final close of the previous year.
    const yearStart = `${latest.date.slice(0, 4)}-01-01`;
    const ytdIndex = indexOnOrBefore(points, shiftDays(yearStart, -1));
    if (ytdIndex >= 0) {
        const row = buildReturn({ key: 'ytd', label: 'Year to date' }, points[ytdIndex], latest, 0);
        if (row) rows.push(row);
    }

    // The full record. Labelled with its real start year by the caller — this
    // is "since we have data", not "all time", and the two are not the same.
    const first = points[0];
    if (first.date !== latest.date) {
        const row = buildReturn(
            { key: 'all', label: `Since ${first.date.slice(0, 4)}` },
            first,
            latest,
            0
        );
        if (row) rows.push(row);
    }

    return rows;
}

/** The fields of a quote this module needs; keeps it free of the API type. */
export interface DayChangeQuote {
    price: number;
    chp: number;
    prev_close_price: number;
}

/**
 * The day change to display for a metal, or null when it genuinely isn't known.
 *
 * Platinum and palladium are quoted by the keyless provider (the metered one is
 * reserved for gold and silver), and that provider returns prev_close_price
 * equal to price with ch and chp both zero. Rendering that as "0.00%" asserts
 * the metal was unchanged on a day palladium moved almost 8% — a fabricated
 * fact, not a missing one.
 *
 * So a quote only counts when it carries a previous close that differs from the
 * current price. Otherwise the previous session's close from our own series
 * becomes the baseline, compared against the price actually on screen so the
 * row stays internally consistent. If neither source can answer, the caller
 * gets null and shows a dash.
 */
export function dayChangePct(
    quote: DayChangeQuote | null,
    series: HistoryPoint[]
): number | null {
    if (quote && Number.isFinite(quote.price) && quote.price > 0) {
        const previous = quote.prev_close_price;
        const hasRealPrevious =
            Number.isFinite(previous) && previous > 0 && previous !== quote.price;

        if (hasRealPrevious) {
            return Number.isFinite(quote.chp) && quote.chp !== 0
                ? quote.chp
                : ((quote.price - previous) / previous) * 100;
        }

        // Fall back to the last close before the most recent one.
        if (series.length >= 2) {
            const baseline = series[series.length - 2].close;
            if (baseline > 0) return ((quote.price - baseline) / baseline) * 100;
        }
        return null;
    }

    // No quote at all: close-to-close from the series alone.
    if (series.length >= 2) {
        const baseline = series[series.length - 2].close;
        const latest = series[series.length - 1].close;
        if (baseline > 0 && Number.isFinite(latest)) {
            return ((latest - baseline) / baseline) * 100;
        }
    }
    return null;
}

export interface SeriesExtremes {
    latest: HistoryPoint;
    previous: HistoryPoint | null;
    /** Highest close on record, and the first date it was reached. */
    high: HistoryPoint;
    /** Lowest close on record, and the first date it was reached. */
    low: HistoryPoint;
    first: HistoryPoint;
    count: number;
    /** Percent below the record close. Zero when the latest close is the record. */
    belowHighPct: number;
}

/**
 * Record high, record low and the current standing against them.
 *
 * Both extremes use a strict comparison, so a later day that merely matches an
 * earlier record does not steal its date — the record belongs to the session
 * that first set it. This matches the convention day-character.ts already
 * follows for record days.
 */
export function seriesExtremes(points: HistoryPoint[]): SeriesExtremes | null {
    if (points.length === 0) return null;

    let high = points[0];
    let low = points[0];
    for (const point of points) {
        if (point.close > high.close) high = point;
        if (point.close < low.close) low = point;
    }

    const latest = points[points.length - 1];
    return {
        latest,
        previous: points.length > 1 ? points[points.length - 2] : null,
        high,
        low,
        first: points[0],
        count: points.length,
        belowHighPct: high.close > 0 ? ((high.close - latest.close) / high.close) * 100 : 0,
    };
}
