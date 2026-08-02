/**
 * Tests for the period maths in src/lib/history-periods.ts.
 *
 * The source is TypeScript, so the logic is mirrored here in plain JS. Keep the
 * two in sync — these pages are generated in bulk, so a parsing bug would
 * publish hundreds of wrong pages at once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const YEAR_RE = /^(\d{4})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isValidMonth = (m) => m >= 1 && m <= 12;

function parsePeriod(slug) {
    if (typeof slug !== 'string') return null;

    const year = YEAR_RE.exec(slug);
    if (year) {
        const y = Number(year[1]);
        if (y < 1900 || y > 2200) return null;
        return { kind: 'year', slug, start: `${year[1]}-01-01`, end: `${year[1]}-12-31`, label: year[1] };
    }

    const month = MONTH_RE.exec(slug);
    if (month) {
        const y = Number(month[1]); const m = Number(month[2]);
        if (!isValidMonth(m) || y < 1900 || y > 2200) return null;
        const last = String(lastDayOfMonth(y, m)).padStart(2, '0');
        return {
            kind: 'month', slug,
            start: `${month[1]}-${month[2]}-01`, end: `${month[1]}-${month[2]}-${last}`,
            label: `${MONTH_NAMES[m - 1]} ${month[1]}`,
        };
    }

    const day = DAY_RE.exec(slug);
    if (day) {
        const y = Number(day[1]); const m = Number(day[2]); const d = Number(day[3]);
        if (!isValidMonth(m) || d < 1 || d > lastDayOfMonth(y, m)) return null;
        return { kind: 'day', slug, start: slug, end: slug, label: `${d} ${MONTH_NAMES[m - 1]} ${day[1]}` };
    }

    return null;
}

function getPeriodStats(points, period) {
    const inRange = points.filter((p) => p.date >= period.start && p.date <= period.end);
    if (inRange.length === 0) return null;

    const closes = inRange.map((p) => p.close);
    const open = closes[0];
    const close = closes[closes.length - 1];

    let high = inRange[0]; let low = inRange[0];
    for (const p of inRange) {
        if (p.close > high.close) high = p;
        if (p.close < low.close) low = p;
    }

    const average = closes.reduce((s, c) => s + c, 0) / closes.length;
    const before = points.filter((p) => p.date < period.start);
    const previousClose = before.length > 0 ? before[before.length - 1].close : null;
    const baseline = previousClose ?? open;

    return {
        period, points: inRange, open, close,
        high: high.close, low: low.close, highDate: high.date, lowDate: low.date,
        average, change: close - baseline,
        changePct: baseline !== 0 ? ((close - baseline) / baseline) * 100 : 0,
        previousClose,
    };
}

function listPeriods(points, kind) {
    const seen = new Set();
    for (const p of points) {
        if (!DAY_RE.test(p.date)) continue;
        if (kind === 'year') seen.add(p.date.slice(0, 4));
        else if (kind === 'month') seen.add(p.date.slice(0, 7));
        else seen.add(p.date);
    }
    return [...seen].sort();
}

const series = [
    { date: '2025-12-30', close: 100 },
    { date: '2025-12-31', close: 110 },
    { date: '2026-01-02', close: 120 },
    { date: '2026-01-15', close: 90 },
    { date: '2026-01-31', close: 130 },
    { date: '2026-02-02', close: 140 },
];

// --- parsePeriod -----------------------------------------------------------

test('parsePeriod reads year, month and day slugs', () => {
    assert.deepEqual(parsePeriod('2026'), {
        kind: 'year', slug: '2026', start: '2026-01-01', end: '2026-12-31', label: '2026',
    });
    assert.equal(parsePeriod('2026-08').label, 'August 2026');
    assert.equal(parsePeriod('2026-08').end, '2026-08-31');
    assert.equal(parsePeriod('2026-08-02').label, '2 August 2026');
});

test('parsePeriod gets month lengths right, including leap years', () => {
    assert.equal(parsePeriod('2026-02').end, '2026-02-28');
    assert.equal(parsePeriod('2024-02').end, '2024-02-29', '2024 is a leap year');
    assert.equal(parsePeriod('2026-04').end, '2026-04-30');
    assert.equal(parsePeriod('2026-12').end, '2026-12-31');
});

test('parsePeriod rejects impossible dates', () => {
    assert.equal(parsePeriod('2026-13'), null, 'month 13');
    assert.equal(parsePeriod('2026-00'), null, 'month 0');
    assert.equal(parsePeriod('2026-02-30'), null, 'Feb 30');
    assert.equal(parsePeriod('2025-02-29'), null, 'Feb 29 in a non-leap year');
    assert.equal(parsePeriod('2026-04-31'), null, 'April 31');
    assert.equal(parsePeriod('2026-01-00'), null, 'day 0');
});

test('parsePeriod rejects junk and out-of-range years', () => {
    assert.equal(parsePeriod('not-a-date'), null);
    assert.equal(parsePeriod('20266'), null);
    assert.equal(parsePeriod('2026-8'), null, 'unpadded month');
    assert.equal(parsePeriod(''), null);
    assert.equal(parsePeriod('1800'), null);
    assert.equal(parsePeriod('9999'), null);
    assert.equal(parsePeriod(null), null);
});

// --- getPeriodStats --------------------------------------------------------

test('getPeriodStats summarises a month', () => {
    const stats = getPeriodStats(series, parsePeriod('2026-01'));
    assert.equal(stats.open, 120);
    assert.equal(stats.close, 130);
    assert.equal(stats.high, 130);
    assert.equal(stats.low, 90);
    assert.equal(stats.highDate, '2026-01-31');
    assert.equal(stats.lowDate, '2026-01-15');
    assert.equal(stats.points.length, 3);
});

test('getPeriodStats measures change from the close before the period', () => {
    const stats = getPeriodStats(series, parsePeriod('2026-01'));
    assert.equal(stats.previousClose, 110, 'last close of December');
    assert.equal(stats.change, 20, '130 - 110');
    assert.ok(Math.abs(stats.changePct - 18.1818) < 0.001);
});

test('getPeriodStats gives a single day a real change figure', () => {
    // A day period holds one point, so change must come from the prior close.
    const stats = getPeriodStats(series, parsePeriod('2026-01-15'));
    assert.equal(stats.close, 90);
    assert.equal(stats.previousClose, 120);
    assert.equal(stats.change, -30);
    assert.ok(stats.changePct < 0);
});

test('getPeriodStats falls back to open when nothing precedes the period', () => {
    const stats = getPeriodStats(series, parsePeriod('2025-12-30'));
    assert.equal(stats.previousClose, null);
    assert.equal(stats.change, 0, 'no baseline, so no movement to report');
});

test('getPeriodStats averages across the period', () => {
    const stats = getPeriodStats(series, parsePeriod('2026-01'));
    assert.ok(Math.abs(stats.average - (120 + 90 + 130) / 3) < 1e-9);
});

test('getPeriodStats summarises a year', () => {
    const stats = getPeriodStats(series, parsePeriod('2026'));
    assert.equal(stats.points.length, 4);
    assert.equal(stats.close, 140);
    assert.equal(stats.low, 90);
});

test('getPeriodStats returns null for a period with no data', () => {
    assert.equal(getPeriodStats(series, parsePeriod('2020')), null);
    assert.equal(getPeriodStats(series, parsePeriod('2026-06-15')), null);
    assert.equal(getPeriodStats([], parsePeriod('2026')), null);
});

// --- listPeriods -----------------------------------------------------------

test('listPeriods enumerates distinct sorted periods', () => {
    assert.deepEqual(listPeriods(series, 'year'), ['2025', '2026']);
    assert.deepEqual(listPeriods(series, 'month'), ['2025-12', '2026-01', '2026-02']);
    assert.equal(listPeriods(series, 'day').length, 6);
});

test('listPeriods ignores malformed dates', () => {
    const dirty = [...series, { date: 'garbage', close: 1 }, { date: '2026', close: 2 }];
    assert.deepEqual(listPeriods(dirty, 'year'), ['2025', '2026']);
});
