import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Mirrors src/lib/coverage.ts. Kept in plain JS so `node --test` can run it
 * without a build step, matching the rest of scripts/*.test.mjs.
 */

const MAX_DAILY_GAP_DAYS = 7;

function daysBetween(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function describeCoverage(series) {
    if (!Array.isArray(series) || series.length === 0) return null;

    const start = series[0].date;
    const end = series[series.length - 1].date;

    let firstDailyIndex = series.length - 1;
    while (
        firstDailyIndex > 0 &&
        daysBetween(series[firstDailyIndex - 1].date, series[firstDailyIndex].date) <=
            MAX_DAILY_GAP_DAYS
    ) {
        firstDailyIndex -= 1;
    }

    const dailyPoints = series.length - firstDailyIndex;
    const hasDailyRun = dailyPoints >= 10;
    const dailyFrom = hasDailyRun ? series[firstDailyIndex].date : null;
    const coversWholeRecord = hasDailyRun && firstDailyIndex === 0;

    let sentence;
    let summary;
    if (coversWholeRecord) {
        sentence = `daily closes from ${start} to ${end}`;
        summary = 'daily closes';
    } else if (dailyFrom) {
        sentence =
            `monthly closes from ${start}, then daily closes from ${dailyFrom} ` + `through ${end}`;
        summary = `monthly closes back to ${start.slice(0, 4)}, daily closes since ${dailyFrom.slice(0, 4)}`;
    } else {
        sentence = `monthly closes from ${start} to ${end}`;
        summary = 'monthly closes';
    }

    return {
        start,
        end,
        points: series.length,
        dailyFrom,
        dailyPoints: hasDailyRun ? dailyPoints : 0,
        sentence,
        summary,
    };
}

function coverageYears(facts) {
    return Math.floor(daysBetween(facts.start, facts.end) / 365.25);
}

const history = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));

test('the committed gold series is not daily throughout, which is what the docs used to claim', () => {
    const facts = describeCoverage(history.series.XAU);
    assert.ok(facts, 'expected a gold series in the committed snapshot');

    // The external truth being asserted: a genuinely daily series spanning
    // this many years would hold roughly 250 points per year. If this ever
    // becomes true, the summary prose should change with it.
    const years = coverageYears(facts);
    assert.ok(years >= 20, `expected a multi-decade record, got ${years} years`);
    assert.ok(
        facts.points < years * 250,
        `series holds ${facts.points} points over ${years} years — that is dense enough to be ` +
            'daily throughout, so describeCoverage and the surrounding prose need revisiting'
    );
    assert.equal(facts.summary.startsWith('daily closes'), false);
});

test('the daily tail is detected and is a minority of the record', () => {
    const facts = describeCoverage(history.series.XAU);
    assert.ok(facts.dailyFrom, 'expected a trailing daily run');
    assert.ok(
        facts.dailyFrom > facts.start,
        'daily cadence should begin after the start of the record'
    );
    assert.ok(
        facts.dailyPoints < facts.points,
        'the daily run should not be the entire series here'
    );
    assert.match(facts.sentence, /^monthly closes from .+ then daily closes from .+ through .+$/);
});

test('gaps inside the detected daily run are all weekend-sized', () => {
    const series = history.series.XAU;
    const facts = describeCoverage(series);
    const tail = series.slice(series.length - facts.dailyPoints);
    for (let i = 1; i < tail.length; i++) {
        const gap = daysBetween(tail[i - 1].date, tail[i].date);
        assert.ok(
            gap <= MAX_DAILY_GAP_DAYS,
            `gap of ${gap} days at ${tail[i].date} inside the supposed daily run`
        );
    }
});

test('gaps before the daily run are monthly-sized, so the threshold is not delicately placed', () => {
    const series = history.series.XAU;
    const facts = describeCoverage(series);
    const head = series.slice(0, series.length - facts.dailyPoints + 1);
    let monthlySized = 0;
    for (let i = 1; i < head.length; i++) {
        if (daysBetween(head[i - 1].date, head[i].date) >= 28) monthlySized++;
    }
    // Every gap in the head should be a month or more; if any were in the
    // 8–27 day range the 7-day threshold would be a judgement call rather
    // than a clean separation.
    assert.equal(
        monthlySized,
        head.length - 1,
        'found gaps between 8 and 27 days, which straddle the daily/monthly threshold'
    );
});

test('a fully daily series is described as such', () => {
    const series = [];
    for (let i = 0; i < 40; i++) {
        const d = new Date(Date.UTC(2026, 0, 1 + i));
        series.push({ date: d.toISOString().slice(0, 10) });
    }
    const facts = describeCoverage(series);
    assert.equal(facts.dailyFrom, series[0].date);
    assert.equal(facts.summary, 'daily closes');
    assert.equal(facts.sentence, `daily closes from ${series[0].date} to ${series[39].date}`);
});

test('a purely monthly series claims no daily cadence', () => {
    const series = [];
    for (let i = 0; i < 24; i++) {
        series.push({ date: `20${24 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01` });
    }
    const facts = describeCoverage(series);
    assert.equal(facts.dailyFrom, null);
    assert.equal(facts.dailyPoints, 0);
    assert.equal(facts.summary, 'monthly closes');
});

test('a short trailing run is not promoted to a cadence claim', () => {
    const series = [
        { date: '2024-01-01' },
        { date: '2024-02-01' },
        { date: '2024-03-01' },
        { date: '2024-03-02' },
        { date: '2024-03-03' },
    ];
    const facts = describeCoverage(series);
    assert.equal(facts.dailyFrom, null, 'three adjacent points are not a daily series');
});

test('empty and malformed input return null rather than throwing', () => {
    assert.equal(describeCoverage([]), null);
    assert.equal(describeCoverage(null), null);
    assert.equal(describeCoverage(undefined), null);
});
