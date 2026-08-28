import type { HistoryPoint } from '@/types';

/**
 * Decides which individual days are distinctive enough to promote.
 *
 * A thousand structurally identical day pages on a young domain will mostly
 * land in "Crawled — currently not indexed": Google samples them, judges the
 * rest to add little, and moves on. That is a content and authority problem,
 * not a URL problem — renaming the slugs would not change it.
 *
 * So the days this returns get promoted while routine days stay live, linked
 * and crawlable but unadvertised. That concentrates crawl budget and internal
 * authority on the month and year pages, which are also where the real search
 * demand is: "gold price November 2024" is searched, "gold price on 4 November
 * 2024" essentially is not.
 *
 * Promotion means two concrete things, both in src/app/sitemap.ts: a notable
 * day is listed in the sitemap wherever it falls, outside the recent-era and
 * demand-year bands, and it carries a higher priority than a routine day. It
 * does NOT mean routine days are noindexed — an earlier version of this
 * comment claimed a "noindex, follow" rule that was never implemented anywhere
 * in the codebase. Every day page that renders is indexable.
 */

/** How many of the largest single-day moves to treat as notable. */
const TOP_MOVES = 20;

/** A day whose move is at least this large is notable regardless of ranking. */
const BIG_MOVE_PCT = 3;

export interface NotableDay {
    date: string;
    /** Why this day is worth indexing — also used as on-page context. */
    reasons: string[];
}

function addReason(map: Map<string, string[]>, date: string | undefined, reason: string) {
    if (!date) return;
    const existing = map.get(date);
    if (existing) {
        if (!existing.includes(reason)) existing.push(reason);
    } else {
        map.set(date, [reason]);
    }
}

/**
 * Returns the notable days in a series, keyed by ISO date.
 *
 * Criteria, all derived from the data rather than hand-picked:
 *  - the all-time high and low on record
 *  - each calendar year's high and low
 *  - each calendar month's high and low
 *  - the largest single-day moves, plus anything above the big-move threshold
 */
export function findNotableDays(points: HistoryPoint[]): Map<string, string[]> {
    const reasons = new Map<string, string[]>();
    if (points.length === 0) return reasons;

    // --- All-time extremes -------------------------------------------------
    let allHigh = points[0];
    let allLow = points[0];
    for (const point of points) {
        if (point.close > allHigh.close) allHigh = point;
        if (point.close < allLow.close) allLow = point;
    }
    addReason(reasons, allHigh.date, 'highest price on record');
    addReason(reasons, allLow.date, 'lowest price on record');

    // --- Per-year and per-month extremes -----------------------------------
    for (const [length, unit] of [
        [4, 'year'],
        [7, 'month'],
    ] as const) {
        const buckets = new Map<string, { high: HistoryPoint; low: HistoryPoint }>();

        for (const point of points) {
            const key = point.date.slice(0, length);
            const bucket = buckets.get(key);
            if (!bucket) {
                buckets.set(key, { high: point, low: point });
                continue;
            }
            if (point.close > bucket.high.close) bucket.high = point;
            if (point.close < bucket.low.close) bucket.low = point;
        }

        for (const bucket of buckets.values()) {
            // A bucket with one point is not an extreme worth publishing.
            if (bucket.high.date === bucket.low.date) continue;
            addReason(reasons, bucket.high.date, `highest close of the ${unit}`);
            addReason(reasons, bucket.low.date, `lowest close of the ${unit}`);
        }
    }

    // --- Largest single-day moves ------------------------------------------
    const moves: { date: string; pct: number }[] = [];
    for (let i = 1; i < points.length; i += 1) {
        const previous = points[i - 1].close;
        if (previous <= 0) continue;
        const pct = ((points[i].close - previous) / previous) * 100;
        if (Number.isFinite(pct)) moves.push({ date: points[i].date, pct });
    }

    moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    for (const move of moves.slice(0, TOP_MOVES)) {
        addReason(reasons, move.date, 'one of the largest single-day moves on record');
    }
    for (const move of moves) {
        if (Math.abs(move.pct) >= BIG_MOVE_PCT) {
            addReason(reasons, move.date, `moved more than ${BIG_MOVE_PCT}% in a session`);
        }
    }

    return reasons;
}

/** Convenience: just the set of notable dates. */
export function notableDaySet(points: HistoryPoint[]): Set<string> {
    return new Set(findNotableDays(points).keys());
}
