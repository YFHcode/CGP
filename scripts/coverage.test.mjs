import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Mirrors src/lib/coverage.ts. Kept in plain JS so `node --test` can run it
 * without a build step, matching the rest of scripts/*.test.mjs.
 */

const MIN_DAILY_PER_YEAR = 100;

function daysBetween(a, b) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function firstDailyIndexByDensity(series) {
    const byYear = new Map();
    for (const point of series) {
        const date = String(point?.date ?? '');
        const year = date.slice(0, 4);
        if (year.length !== 4) continue;
        const entry = byYear.get(year);
        if (entry) {
            entry.count++;
            if (date < entry.first) entry.first = date;
            if (date > entry.last) entry.last = date;
        } else {
            byYear.set(year, { count: 1, first: date, last: date });
        }
    }
    if (byYear.size === 0) return series.length;

    const isDense = (e) => {
        const span = Math.max(1, daysBetween(e.first, e.last) + 1);
        return e.count >= Math.max(10, (MIN_DAILY_PER_YEAR * span) / 365);
    };

    const years = [...byYear.keys()].sort();
    let firstYear = null;
    for (let i = years.length - 1; i >= 0; i--) {
        const entry = byYear.get(years[i]);
        if (!entry || !isDense(entry)) break;
        firstYear = years[i];
    }
    if (firstYear === null) return series.length;
    const index = series.findIndex((p) => p.date.slice(0, 4) === firstYear);
    return index >= 0 ? index : series.length;
}

function describeCoverage(series) {
    if (!Array.isArray(series) || series.length === 0) return null;
    const start = series[0].date;
    const end = series[series.length - 1].date;
    const firstDailyIndex = firstDailyIndexByDensity(series);
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
        sentence = `monthly closes from ${start}, then daily closes from ${dailyFrom} ` + `through ${end}`;
        summary = `monthly closes back to ${start.slice(0, 4)}, daily closes since ${dailyFrom.slice(0, 4)}`;
    } else {
        sentence = `monthly closes from ${start} to ${end}`;
        summary = 'monthly closes';
    }
    return { start, end, points: series.length, dailyFrom, dailyPoints: hasDailyRun ? dailyPoints : 0, sentence, summary };
}

function coverageYears(f) {
    return Math.floor(daysBetween(f.start, f.end) / 365.25);
}

const history = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));





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

// --- Against the committed series, after the daily backfill -----------------

test('the committed gold series is now daily across the whole record', () => {
    // This replaces three tests written when the archive was monthly before
    // 2024. They asserted the opposite and failed the moment the backfill
    // landed, which is what they were for — the failure message said the prose
    // needed revisiting, and it did.
    const facts = describeCoverage(history.series.XAU);
    assert.ok(facts, 'expected a gold series in the committed snapshot');

    const years = coverageYears(facts);
    assert.ok(years >= 20, `expected a multi-decade record, got ${years} years`);
    assert.ok(
        facts.points > years * 200,
        `series holds ${facts.points} points over ${years} years — too sparse to be daily`
    );
    assert.equal(facts.dailyFrom, facts.start, 'daily cadence should start at the first observation');
    assert.equal(facts.summary, 'daily closes');
    assert.match(facts.sentence, /^daily closes from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/);
});

test('isolated multi-week gaps do not truncate the detected daily run', () => {
    // The regression that motivated the density rule. The real series contains
    // a handful of 8-to-27 day holes (exchange holidays, upstream gaps); a
    // backwards walk that stopped at the first one reported a 6,450-point
    // daily series as "monthly until 2024".
    const series = [];
    const d = new Date(Date.UTC(2020, 0, 1));
    for (let i = 0; i < 500; i++) {
        // Insert a 20-day hole a third of the way in.
        if (i === 160) d.setUTCDate(d.getUTCDate() + 20);
        if (d.getUTCDay() % 6 !== 0) series.push({ date: d.toISOString().slice(0, 10), close: 100 });
        d.setUTCDate(d.getUTCDate() + 1);
    }
    const facts = describeCoverage(series);
    assert.equal(facts.summary, 'daily closes', 'one 20-day hole must not demote the series');
});

test('a genuinely monthly series is still reported as monthly', () => {
    // The density rule must not simply call everything daily.
    const series = [];
    for (let y = 2010; y <= 2020; y++) {
        for (let m = 1; m <= 12; m++) {
            series.push({ date: `${y}-${String(m).padStart(2, '0')}-01`, close: 100 });
        }
    }
    const facts = describeCoverage(series);
    assert.equal(facts.summary, 'monthly closes');
    assert.equal(facts.dailyFrom, null);
});

test('a monthly record with a daily tail is still described as both', () => {
    const series = [];
    for (let y = 2015; y <= 2023; y++) {
        for (let m = 1; m <= 12; m++) {
            series.push({ date: `${y}-${String(m).padStart(2, '0')}-01`, close: 100 });
        }
    }
    const d = new Date(Date.UTC(2024, 0, 1));
    for (let i = 0; i < 400; i++) {
        if (d.getUTCDay() % 6 !== 0) series.push({ date: d.toISOString().slice(0, 10), close: 100 });
        d.setUTCDate(d.getUTCDate() + 1);
    }
    const facts = describeCoverage(series);
    assert.equal(facts.dailyFrom?.slice(0, 4), '2024');
    assert.match(facts.sentence, /^monthly closes from .+ then daily closes from .+ through .+$/);
});
