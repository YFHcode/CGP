import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Mirrors src/lib/day-character.ts.
 *
 * The assertions target the property the classifier exists for: that a real
 * price series produces a *spread* of characters rather than labelling
 * everything the same. A classifier that returns "ordinary" for 99% of days
 * would typecheck, pass a naive unit test, and completely fail to fix the
 * duplicate-template problem it was written for.
 */

const BIG_MOVE_PCT = 2;
const QUIET_MOVE_PCT = 0.15;
const MIN_STREAK = 3;

function isoWeekKey(date) {
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

function computeDayProfile(series, date) {
    if (!Array.isArray(series) || series.length === 0) return null;
    const index = series.findIndex((p) => p.date === date);
    if (index <= 0) return null;

    const close = series[index].close;
    const previous = series[index - 1].close;
    if (!Number.isFinite(close) || !Number.isFinite(previous) || previous <= 0) return null;
    const changePct = ((close - previous) / previous) * 100;

    const direction = changePct > 0 ? 'up' : changePct < 0 ? 'down' : null;
    let streakLength = 0;
    if (direction) {
        for (let i = index; i > 0; i--) {
            const move = series[i].close - series[i - 1].close;
            if (direction === 'up' ? move > 0 : move < 0) streakLength++;
            else break;
        }
    }
    const streak = direction && streakLength >= MIN_STREAK ? { direction, length: streakLength } : null;

    let sessionsSinceHigher = null;
    let sessionsSinceLower = null;
    for (let i = index - 1; i >= 0; i--) {
        if (sessionsSinceHigher === null && series[i].close > close) sessionsSinceHigher = index - i;
        if (sessionsSinceLower === null && series[i].close < close) sessionsSinceLower = index - i;
        if (sessionsSinceHigher !== null && sessionsSinceLower !== null) break;
    }

    let allTimeHigh = series[0];
    for (let i = 1; i <= index; i++) if (series[i].close > allTimeHigh.close) allTimeHigh = series[i];
    const belowAllTimeHighPct =
        allTimeHigh.close > 0 ? ((allTimeHigh.close - close) / allTimeHigh.close) * 100 : null;

    const year = date.slice(0, 4);
    const yearCloses = series.filter((p) => p.date.slice(0, 4) === year).map((p) => p.close);
    const rankInYear =
        yearCloses.length > 0
            ? { rank: yearCloses.filter((c) => c > close).length + 1, of: yearCloses.length }
            : null;

    const week = isoWeekKey(date);
    const month = date.slice(0, 7);
    const priorIn = (pred) => series.slice(0, index).filter(pred);
    const isWeekHigh = priorIn((p) => isoWeekKey(p.date) === week).every((p) => p.close < close);
    const isMonthHigh = priorIn((p) => p.date.slice(0, 7) === month).every((p) => p.close < close);
    const isYearHigh = priorIn((p) => p.date.slice(0, 4) === year).every((p) => p.close < close);

    const magnitude = Math.abs(changePct);
    const previousChange = index > 1 ? series[index - 1].close - series[index - 2].close : 0;
    const reversed =
        direction !== null &&
        previousChange !== 0 &&
        (direction === 'up') !== previousChange > 0 &&
        magnitude >= BIG_MOVE_PCT / 2;

    const prior = series.slice(0, index);
    const isRecordHigh = prior.every((p) => p.close < close);
    const isRecordLow = prior.every((p) => p.close > close);

    let character;
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

const series = (closes, start = '2026-01-01') =>
    closes.map((close, i) => {
        const d = new Date(`${start}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        return { date: d.toISOString().slice(0, 10), close };
    });

test('a new high above every prior close is a record', () => {
    const s = series([100, 101, 102, 103]);
    assert.equal(computeDayProfile(s, s[3].date).character, 'record-high');
});

test('a new low below every prior close is a record low', () => {
    const s = series([100, 99, 98, 97]);
    assert.equal(computeDayProfile(s, s[3].date).character, 'record-low');
});

test('a move at or beyond the big-move threshold is a surge or plunge', () => {
    // Both fixtures must sit inside the prior range, or the record rules win
    // first — which is correct precedence, but not what this test is checking.
    const up = series([100, 90, 100]); // +11%, ties the prior high, not above it
    assert.equal(computeDayProfile(up, up[2].date).character, 'surge');
    const down = series([50, 100, 120, 100]); // -16.7%, still above the prior low
    assert.equal(computeDayProfile(down, down[3].date).character, 'plunge');
});

test('a run of three or more same-direction sessions is a streak', () => {
    // Rising but under a prior peak, so it is not classified as a record.
    const s = series([200, 100, 101, 102, 103]);
    const p = computeDayProfile(s, s[4].date);
    assert.equal(p.character, 'streak');
    assert.equal(p.streak.direction, 'up');
    assert.equal(p.streak.length, 3);
});

test('a barely-moving session is quiet', () => {
    const s = series([200, 100, 100.05]);
    assert.equal(computeDayProfile(s, s[2].date).character, 'quiet');
});

test('the first point has no profile, since it has nothing to compare against', () => {
    const s = series([100, 101]);
    assert.equal(computeDayProfile(s, s[0].date), null);
    assert.equal(computeDayProfile(s, '1999-01-01'), null);
    assert.equal(computeDayProfile([], '2026-01-01'), null);
    assert.equal(computeDayProfile(null, '2026-01-01'), null);
});

test('week/month/year highs are measured against prior sessions only', () => {
    const s = [
        { date: '2026-03-02', close: 100 },
        { date: '2026-03-03', close: 105 },
    ];
    const p = computeDayProfile(s, '2026-03-03');
    assert.equal(p.isWeekHigh, true);
    assert.equal(p.isMonthHigh, true);
    assert.equal(p.isYearHigh, true);
});

test('distance from the record uses the high as at that date, not the final high', () => {
    // A later spike must not retroactively change what an earlier day was
    // "below" — the page describes the record as it stood on that date.
    const s = series([100, 90, 500]);
    const p = computeDayProfile(s, s[1].date);
    assert.equal(p.allTimeHighDate, s[0].date);
    assert.ok(Math.abs(p.belowAllTimeHighPct - 10) < 1e-9);
});

// --- The property that actually matters -----------------------------------

const history = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));

test('a real series yields a spread of characters, not one label for everything', () => {
    const points = history.series.XAU;
    assert.ok(points.length > 100, 'expected a substantial committed series');

    const counts = new Map();
    for (const p of points.slice(1)) {
        const profile = computeDayProfile(points, p.date);
        if (!profile) continue;
        counts.set(profile.character, (counts.get(profile.character) ?? 0) + 1);
    }

    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const distinct = counts.size;
    const largest = Math.max(...counts.values());

    // The whole point is differentiation. If one character covered nearly
    // everything, day pages would still share a skeleton and this would be
    // decoration rather than a fix.
    assert.ok(distinct >= 4, `expected at least 4 distinct characters, got ${distinct}`);
    assert.ok(
        largest / total < 0.8,
        `one character covers ${((largest / total) * 100).toFixed(0)}% of sessions — too uniform to differentiate pages`
    );
});

test('tying the previous record is not itself a record', () => {
    // Caught by a fixture that meant to exercise a large move: matching the
    // prior high was being reported as a new record, because "nothing closed
    // higher" is true of a tie as well as of a break.
    const s = series([100, 90, 100]);
    const p = computeDayProfile(s, s[2].date);
    assert.notEqual(p.character, 'record-high', 'a tie must not be reported as a record');
    assert.equal(p.character, 'surge', 'an 11% move should be classified by its size');
});
