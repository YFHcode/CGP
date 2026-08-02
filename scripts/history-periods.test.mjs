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

const MONTH_SLUGS = MONTH_NAMES.map((m) => m.toLowerCase());
const MONTH_NAME_RE = /^([a-z]+)-(\d{4})$/i;
const DAY_NAME_RE = /^(\d{1,2})-([a-z]+)-(\d{4})$/i;
const monthNumberFromName = (n) => MONTH_SLUGS.indexOf(String(n).toLowerCase()) + 1;

function slugForKey(key, kind) {
    if (kind === 'year') return key;
    const [y, m, d] = key.split('-');
    const name = MONTH_SLUGS[Number(m) - 1];
    if (!name) return key;
    return kind === 'month' ? `${name}-${y}` : `${Number(d)}-${name}-${y}`;
}

function buildPeriod(kind, y, m, d) {
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
        return { kind, key, slug: slugForKey(key, 'month'), start: `${key}-01`, end: `${key}-${last}`,
                 label: `${MONTH_NAMES[m - 1]} ${y}` };
    }
    if (d < 1 || d > lastDayOfMonth(y, m)) return null;
    const key = `${y}-${mm}-${String(d).padStart(2, '0')}`;
    return { kind: 'day', key, slug: slugForKey(key, 'day'), start: key, end: key,
             label: `${d} ${MONTH_NAMES[m - 1]} ${y}` };
}

function parsePeriod(slug) {
    if (typeof slug !== 'string') return null;

    const year = YEAR_RE.exec(slug);
    if (year) return buildPeriod('year', Number(year[1]), 0, 0);

    const isoMonth = MONTH_RE.exec(slug);
    if (isoMonth) return buildPeriod('month', Number(isoMonth[1]), Number(isoMonth[2]), 0);

    const isoDay = DAY_RE.exec(slug);
    if (isoDay) return buildPeriod('day', Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]));

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
        kind: 'year', key: '2026', slug: '2026',
        start: '2026-01-01', end: '2026-12-31', label: '2026',
    });
    assert.equal(parsePeriod('2026-08').label, 'August 2026');
    assert.equal(parsePeriod('2026-08').end, '2026-08-31');
    assert.equal(parsePeriod('2026-08-02').label, '2 August 2026');
});

test('canonical slugs are readable, not ISO', () => {
    assert.equal(parsePeriod('2026').slug, '2026');
    assert.equal(parsePeriod('2026-08').slug, 'august-2026');
    assert.equal(parsePeriod('2026-08-02').slug, '2-august-2026');
    assert.equal(parsePeriod('2025-02-13').slug, '13-february-2025');
});

test('parsePeriod accepts readable slugs and resolves them identically to ISO', () => {
    // Old ISO URLs must keep resolving so anything already indexed still works.
    assert.deepEqual(parsePeriod('13-february-2025'), parsePeriod('2025-02-13'));
    assert.deepEqual(parsePeriod('february-2025'), parsePeriod('2025-02'));
    assert.equal(parsePeriod('2-august-2026').key, '2026-08-02');
    assert.equal(parsePeriod('AUGUST-2026').key, '2026-08', 'case insensitive');
});

test('parsePeriod rejects invalid month names and impossible readable dates', () => {
    assert.equal(parsePeriod('smarch-2026'), null);
    assert.equal(parsePeriod('30-february-2026'), null);
    assert.equal(parsePeriod('0-august-2026'), null);
});

test('slugForKey round-trips through parsePeriod', () => {
    for (const [key, kind] of [['2026', 'year'], ['2026-08', 'month'], ['2026-08-02', 'day']]) {
        const slug = slugForKey(key, kind);
        assert.equal(parsePeriod(slug).key, key, `${slug} should resolve back to ${key}`);
    }
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
