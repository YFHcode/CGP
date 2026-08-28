import type { HistoryPoint } from '@/types';

/**
 * What kind of day a given session actually was.
 *
 * The archive's problem was never missing data — it was that every day page
 * said the same things in the same order. Strip the date and the numbers from
 * ten of them and 90-100% of the remaining text was identical, because the
 * template asked the same seven questions and rendered the same seven sections
 * whether the day set an all-time record or moved four cents.
 *
 * Varying the *numbers* does not fix that; a reader (or a duplicate-content
 * classifier) sees the prose. So this classifies each session from its own
 * data and lets the page choose which sections and which questions to render.
 * Two adjacent days genuinely differ — one broke a three-day losing streak,
 * the other was the quietest session of its month — and the page can now say
 * so instead of flattening both into the same paragraph.
 *
 * Every field here is derived, never hand-authored, so this cannot drift out
 * of step with the series.
 */

export type DayCharacter =
    | 'record-high'
    | 'record-low'
    | 'high-since'
    | 'low-since'
    | 'surge'
    | 'plunge'
    | 'reversal'
    | 'streak'
    | 'quiet'
    | 'ordinary';

export interface DayProfile {
    character: DayCharacter;
    /** Consecutive sessions moving the same way, including this one. */
    streak: { direction: 'up' | 'down'; length: number } | null;
    /** Sessions since the price last closed higher. Null if never. */
    sessionsSinceHigher: number | null;
    /** Sessions since the price last closed lower. Null if never. */
    sessionsSinceLower: number | null;
    /** How far below the all-time high this close sits, as a percentage. */
    belowAllTimeHighPct: number | null;
    allTimeHighDate: string | null;
    /** Rank of this close within its calendar year, 1 = highest. */
    rankInYear: { rank: number; of: number } | null;
    /** True when this close is the highest so far in its week/month/year. */
    isWeekHigh: boolean;
    isMonthHigh: boolean;
    isYearHigh: boolean;
    changePct: number | null;
}

/** A move at or above this size is "big" in either direction. */
const BIG_MOVE_PCT = 2;
/** Below this, the session barely moved. */
const QUIET_MOVE_PCT = 0.15;
/** Consecutive sessions needed before a run is worth naming. */
const MIN_STREAK = 3;

function isoWeekKey(date: string): string {
    // Thursday-anchored ISO week, so a week never spans two labels.
    const d = new Date(`${date}T00:00:00Z`);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week =
        1 +
        Math.round(
            (d.getTime() - firstThursday.getTime()) / 604_800_000 -
                ((firstThursday.getUTCDay() + 6) % 7) / 7
        );
    return `${d.getUTCFullYear()}-W${week}`;
}

/**
 * Builds the profile for one session.
 *
 * Returns null for the first point in a series, which has no prior session to
 * be measured against — the caller falls back to the undifferentiated layout
 * rather than inventing comparisons.
 */
export function computeDayProfile(series: HistoryPoint[], date: string): DayProfile | null {
    if (!Array.isArray(series) || series.length === 0) return null;
    const index = series.findIndex((p) => p.date === date);
    if (index <= 0) return null;

    const close = series[index].close;
    const previous = series[index - 1].close;
    if (!Number.isFinite(close) || !Number.isFinite(previous) || previous <= 0) return null;

    const changePct = ((close - previous) / previous) * 100;

    // --- Streak: walk back while the direction holds -----------------------
    const direction: 'up' | 'down' | null =
        changePct > 0 ? 'up' : changePct < 0 ? 'down' : null;
    let streakLength = 0;
    if (direction) {
        for (let i = index; i > 0; i--) {
            const move = series[i].close - series[i - 1].close;
            if (direction === 'up' ? move > 0 : move < 0) streakLength++;
            else break;
        }
    }
    const streak =
        direction && streakLength >= MIN_STREAK
            ? { direction, length: streakLength }
            : null;

    // --- How long since this level was seen --------------------------------
    let sessionsSinceHigher: number | null = null;
    let sessionsSinceLower: number | null = null;
    for (let i = index - 1; i >= 0; i--) {
        if (sessionsSinceHigher === null && series[i].close > close) {
            sessionsSinceHigher = index - i;
        }
        if (sessionsSinceLower === null && series[i].close < close) {
            sessionsSinceLower = index - i;
        }
        if (sessionsSinceHigher !== null && sessionsSinceLower !== null) break;
    }

    // --- All-time high up to and including this day ------------------------
    let allTimeHigh = series[0];
    for (let i = 1; i <= index; i++) {
        if (series[i].close > allTimeHigh.close) allTimeHigh = series[i];
    }
    const belowAllTimeHighPct =
        allTimeHigh.close > 0 ? ((allTimeHigh.close - close) / allTimeHigh.close) * 100 : null;

    // --- Rank within its calendar year -------------------------------------
    const year = date.slice(0, 4);
    const yearCloses = series.filter((p) => p.date.slice(0, 4) === year).map((p) => p.close);
    const rankInYear =
        yearCloses.length > 0
            ? { rank: yearCloses.filter((c) => c > close).length + 1, of: yearCloses.length }
            : null;

    // --- Highest so far within its week / month / year ---------------------
    const week = isoWeekKey(date);
    const month = date.slice(0, 7);
    const priorIn = (pred: (p: HistoryPoint) => boolean) =>
        series.slice(0, index).filter(pred);
    const isWeekHigh = priorIn((p) => isoWeekKey(p.date) === week).every((p) => p.close < close);
    const isMonthHigh = priorIn((p) => p.date.slice(0, 7) === month).every((p) => p.close < close);
    const isYearHigh = priorIn((p) => p.date.slice(0, 4) === year).every((p) => p.close < close);

    // --- Character, most specific first ------------------------------------
    const magnitude = Math.abs(changePct);
    const previousChange =
        index > 1 ? series[index - 1].close - series[index - 2].close : 0;
    const reversed =
        direction !== null &&
        previousChange !== 0 &&
        (direction === 'up') !== previousChange > 0 &&
        magnitude >= BIG_MOVE_PCT / 2;

    // A record must be strictly above (or below) every prior close. Matching
    // the previous record is not breaking it, and `sessionsSinceHigher` alone
    // cannot tell the two apart, because it searches for a *higher* close and
    // an equal one is not higher.
    const prior = series.slice(0, index);
    const isRecordHigh = prior.every((p) => p.close < close);
    const isRecordLow = prior.every((p) => p.close > close);

    let character: DayCharacter;
    if (isRecordHigh) character = 'record-high';
    else if (isRecordLow) character = 'record-low';
    else if (magnitude >= BIG_MOVE_PCT) character = changePct > 0 ? 'surge' : 'plunge';
    else if (sessionsSinceHigher !== null && sessionsSinceHigher >= 250) character = 'high-since';
    else if (sessionsSinceLower !== null && sessionsSinceLower >= 250) character = 'low-since';
    else if (streak) character = 'streak';
    else if (reversed) character = 'reversal';
    else if (magnitude <= QUIET_MOVE_PCT) character = 'quiet';
    else character = 'ordinary';

    return {
        character,
        streak,
        sessionsSinceHigher,
        sessionsSinceLower,
        belowAllTimeHighPct,
        allTimeHighDate: allTimeHigh.date,
        rankInYear,
        isWeekHigh,
        isMonthHigh,
        isYearHigh,
        changePct,
    };
}
