import type { HistoryPoint } from '@/types';

/**
 * Describes a date inside our covered range that has no closing price.
 *
 * These URLs were the largest silent defect in the archive. A request for
 * /gold-price/2-may-2010 — a Sunday — reached notFound(), which Next then
 * prerendered and served as HTTP 200 with a "Page not found" body under the
 * title "Gold price, 2 May 2010". About six thousand weekend and holiday URLs
 * across both metals behaved that way: soft 404s wearing a real page's title,
 * cached for a day at a time.
 *
 * A 404 would have been correct but unhelpful. The question behind the URL has
 * a real answer — markets were shut, here is the close on either side — and it
 * is the answer Google's own summary gives for these dates. So the date gets a
 * page, built from the two sessions that bracket it.
 */

export type ClosureReason = 'weekend' | 'holiday';

export interface ClosedDay {
    date: string;
    reason: ClosureReason;
    /** Last session before this date, and first session after. */
    previous: HistoryPoint | null;
    next: HistoryPoint | null;
    /** Change across the closure, when both sides are known. */
    changeAcross: number | null;
    changeAcrossPct: number | null;
    /** Consecutive non-trading days this one belongs to, including itself. */
    closureLength: number;
}

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const shift = (iso: string, days: number) =>
    new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10);

function isWeekend(iso: string): boolean {
    const day = new Date(toUtc(iso)).getUTCDay();
    return day === 0 || day === 6;
}

/** Index of the last point dated at or before `target`, or -1. */
function indexOnOrBefore(points: HistoryPoint[], target: string): number {
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

/**
 * Returns closure context for a date, or null when the date should 404 instead.
 *
 * Null means one of three things, all of which are genuinely not-found rather
 * than closed: the date has its own close and belongs on a normal day page; it
 * falls outside the range we hold, so we have nothing to say about it; or the
 * input is not a date at all. Only dates strictly inside the covered range get
 * a page, so a request for 1850 or for next year still 404s properly.
 */
export function describeClosedDay(series: HistoryPoint[], iso: string): ClosedDay | null {
    if (!Array.isArray(series) || series.length === 0) return null;
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    if (!Number.isFinite(toUtc(iso))) return null;

    const first = series[0].date;
    const last = series[series.length - 1].date;
    if (iso <= first || iso >= last) return null;

    const index = indexOnOrBefore(series, iso);
    if (index < 0) return null;
    if (series[index].date === iso) return null; // a trading day; not our business

    const previous = series[index] ?? null;
    const next = series[index + 1] ?? null;

    const changeAcross =
        previous && next && Number.isFinite(previous.close) && Number.isFinite(next.close)
            ? next.close - previous.close
            : null;
    const changeAcrossPct =
        changeAcross !== null && previous && previous.close > 0
            ? (changeAcross / previous.close) * 100
            : null;

    // How long the market was shut, counted in calendar days between the two
    // sessions. A weekend is 2; Easter or Christmas can be 3 or 4.
    const closureLength =
        previous && next
            ? Math.max(1, Math.round((toUtc(next.date) - toUtc(previous.date)) / DAY_MS) - 1)
            : 1;

    return {
        date: iso,
        reason: isWeekend(iso) ? 'weekend' : 'holiday',
        previous,
        next,
        changeAcross,
        changeAcrossPct,
        closureLength,
    };
}

/**
 * A plain-language sentence for why there is no price, used as the page lead.
 *
 * Weekends are stated as fact. Everything else is described as a market
 * closure without naming a holiday: the series is COMEX futures traded across
 * several jurisdictions, and guessing "Thanksgiving" from a date alone would
 * be wrong for a national day of mourning, an exchange outage, or any of the
 * other reasons a session does not settle.
 */
export function closureSentence(closed: ClosedDay, metalName: string): string {
    const weekdayName = new Date(toUtc(closed.date)).toLocaleDateString('en-GB', {
        weekday: 'long',
        timeZone: 'UTC',
    });

    if (closed.reason === 'weekend') {
        return `${weekdayName} was a weekend, so ${metalName.toLowerCase()} futures did not trade and there is no closing price for this date.`;
    }
    return `Markets were closed on this ${weekdayName}, so ${metalName.toLowerCase()} futures did not settle and there is no closing price for this date.`;
}

/** Every non-trading date inside the covered range. Used for sizing, not routing. */
export function closedDatesInRange(series: HistoryPoint[]): string[] {
    if (!Array.isArray(series) || series.length < 2) return [];
    const have = new Set(series.map((point) => point.date));
    const out: string[] = [];
    for (
        let date = shift(series[0].date, 1);
        date < series[series.length - 1].date;
        date = shift(date, 1)
    ) {
        if (!have.has(date)) out.push(date);
    }
    return out;
}
