import type { HistoryPoint } from '@/types';
import { formatLongDate, formatShortMonthYear } from './history-periods';

/**
 * A single punchy headline for a day page, in the style of the daily
 * "gold prices today" roundups financial sites publish — "highest closing
 * price since 3 June 2026" rather than a bare stats table.
 *
 * Every headline is a direct read of the stored series: it either is or
 * isn't the highest/lowest close since some real prior date, or it isn't a
 * big move, computed rather than chosen. A day with nothing distinctive
 * about it gets no headline at all — the page falls back to the plain
 * "closed at $X, up/down Y%" framing already in the intro paragraph, rather
 * than manufacturing a superlative that isn't there.
 */

const MEANINGFUL_GAP_DAYS = 10;
const BIG_MOVE_PCT = 3;

export interface DayHeadline {
    text: string;
    /**
     * A compact variant for title tags, where the full sentence won't fit.
     * Reference dates are abbreviated to month and year here ("Lowest Since
     * Jan 2016") because Google truncates titles at roughly 60 characters and
     * the hook is what gets cut first.
     */
    shortText: string;
    kind: 'all-time-high' | 'all-time-low' | 'high-since' | 'low-since' | 'big-move';
}

function daysBetween(a: string, b: string): number {
    const msPerDay = 86_400_000;
    return Math.round(
        (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / msPerDay
    );
}

/** Finds the most recent point before `index` whose close matches `test`. */
function mostRecentMatch(
    series: HistoryPoint[],
    index: number,
    test: (close: number) => boolean
): HistoryPoint | null {
    for (let i = index - 1; i >= 0; i -= 1) {
        if (test(series[i].close)) return series[i];
    }
    return null;
}

export function computeDayHeadline(
    series: HistoryPoint[],
    date: string,
    metalName: string
): DayHeadline | null {
    const index = series.findIndex((p) => p.date === date);
    if (index <= 0) return null; // no prior data to compare against

    const current = series[index].close;
    const highSince = mostRecentMatch(series, index, (c) => c >= current);
    const lowSince = mostRecentMatch(series, index, (c) => c <= current);

    if (!highSince) {
        return {
            text: `${metalName}'s highest closing price on record`,
            shortText: 'All-Time High',
            kind: 'all-time-high',
        };
    }
    if (!lowSince) {
        return {
            text: `${metalName}'s lowest closing price on record`,
            shortText: 'All-Time Low',
            kind: 'all-time-low',
        };
    }

    const highGap = daysBetween(highSince.date, date);
    const lowGap = daysBetween(lowSince.date, date);

    if (highGap >= MEANINGFUL_GAP_DAYS && highGap >= lowGap) {
        return {
            text: `Highest closing price since ${formatLongDate(highSince.date)}`,
            shortText: `Highest Since ${formatShortMonthYear(highSince.date, date)}`,
            kind: 'high-since',
        };
    }
    if (lowGap >= MEANINGFUL_GAP_DAYS) {
        return {
            text: `Lowest closing price since ${formatLongDate(lowSince.date)}`,
            shortText: `Lowest Since ${formatShortMonthYear(lowSince.date, date)}`,
            kind: 'low-since',
        };
    }

    const previous = series[index - 1].close;
    if (previous > 0) {
        const pct = ((current - previous) / previous) * 100;
        if (Math.abs(pct) >= BIG_MOVE_PCT) {
            const pctText = `${Math.abs(pct).toFixed(1)}%`;
            return {
                text: `${metalName} ${pct >= 0 ? 'jumps' : 'falls'} ${pctText} in a single session`,
                shortText: pct >= 0 ? `Jumps ${pctText}` : `Falls ${pctText}`,
                kind: 'big-move',
            };
        }
    }

    return null;
}
