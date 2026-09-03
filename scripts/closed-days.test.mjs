import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Mirrors src/lib/closed-days.ts.
 *
 * The rule that matters is the boundary between "closed" and "not found".
 * Getting it wrong in one direction reintroduces the soft 404s this replaces;
 * in the other it publishes a page for every date in history, including ones
 * we have no business having an opinion about.
 */

const DAY_MS = 86_400_000;
const toUtc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const isWeekend = (iso) => {
    const d = new Date(toUtc(iso)).getUTCDay();
    return d === 0 || d === 6;
};

function indexOnOrBefore(points, target) {
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

function describeClosedDay(series, iso) {
    if (!Array.isArray(series) || series.length === 0) return null;
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    if (!Number.isFinite(toUtc(iso))) return null;

    const first = series[0].date;
    const last = series[series.length - 1].date;
    if (iso <= first || iso >= last) return null;

    const index = indexOnOrBefore(series, iso);
    if (index < 0) return null;
    if (series[index].date === iso) return null;

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

const day = (date, close) => ({ date, close });

/** Fri 30 Apr, Mon 3 May, Tue 4 May 2010 — a real weekend from the archive. */
const MAY_2010 = [
    day('2010-04-29', 1168.4),
    day('2010-04-30', 1180.1),
    day('2010-05-03', 1182.7),
    day('2010-05-04', 1168.6),
];

test('a weekend date inside the range is described, not rejected', () => {
    const closed = describeClosedDay(MAY_2010, '2010-05-02');
    assert.ok(closed, 'Sunday 2 May 2010 should be a closed day');
    assert.equal(closed.reason, 'weekend');
    assert.equal(closed.previous.date, '2010-04-30');
    assert.equal(closed.next.date, '2010-05-03');
});

test('the change across a closure is measured between the two sessions', () => {
    const closed = describeClosedDay(MAY_2010, '2010-05-01');
    // 1180.10 -> 1182.70
    assert.ok(Math.abs(closed.changeAcross - 2.6) < 1e-9);
    assert.ok(Math.abs(closed.changeAcrossPct - (2.6 / 1180.1) * 100) < 1e-9);
});

test('closure length counts the days the market was actually shut', () => {
    // Saturday and Sunday between Friday and Monday.
    assert.equal(describeClosedDay(MAY_2010, '2010-05-01').closureLength, 2);
});

test('a trading day is not a closed day', () => {
    // It has its own page with its own price; this must not shadow it.
    assert.equal(describeClosedDay(MAY_2010, '2010-05-03'), null);
    assert.equal(describeClosedDay(MAY_2010, '2010-04-30'), null);
});

test('a weekday closure is reported as a holiday rather than a weekend', () => {
    const series = [day('2010-12-23', 100), day('2010-12-27', 101)];
    const closed = describeClosedDay(series, '2010-12-24');
    assert.equal(closed.reason, 'holiday');
    assert.equal(new Date('2010-12-24T00:00:00Z').getUTCDay(), 5, 'fixture must be a Friday');
});

test('dates outside the covered range are not found rather than closed', () => {
    // The distinction that keeps this from publishing a page for all history.
    assert.equal(describeClosedDay(MAY_2010, '1850-01-01'), null);
    assert.equal(describeClosedDay(MAY_2010, '2099-01-01'), null);
    // The endpoints themselves belong to the range, not outside it.
    assert.equal(describeClosedDay(MAY_2010, '2010-04-29'), null);
    assert.equal(describeClosedDay(MAY_2010, '2010-05-04'), null);
});

test('malformed input is rejected rather than throwing', () => {
    for (const bad of [null, undefined, '', 'nope', '2010-13-45', 42, {}]) {
        assert.equal(describeClosedDay(MAY_2010, bad), null, `unexpected for ${String(bad)}`);
    }
    for (const bad of [null, undefined, [], 'nope']) {
        assert.equal(describeClosedDay(bad, '2010-05-02'), null);
    }
});

// --- against the real series --------------------------------------------------

const history = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));

test('every closed day in the real series has a session on both sides', () => {
    // The page cannot be rendered honestly without both, so a null on either
    // side would mean a blank answer shipped at scale.
    for (const [symbol, series] of Object.entries(history.series)) {
        const have = new Set(series.map((p) => p.date));
        let checked = 0;
        // Sample across the whole span rather than walking ~3,000 dates twice.
        for (let i = 1; i < series.length - 1; i += 37) {
            const probe = new Date(toUtc(series[i].date) + DAY_MS).toISOString().slice(0, 10);
            if (have.has(probe)) continue;
            const closed = describeClosedDay(series, probe);
            assert.ok(closed, `${symbol} ${probe} should be a closed day`);
            assert.ok(closed.previous && closed.next, `${symbol} ${probe} missing a side`);
            assert.ok(closed.previous.date < probe && closed.next.date > probe);
            checked++;
        }
        assert.ok(checked > 20, `${symbol}: only ${checked} closed days sampled`);
    }
});

test('no real trading day is mistaken for a closure', () => {
    for (const [symbol, series] of Object.entries(history.series)) {
        for (let i = 1; i < series.length - 1; i += 29) {
            assert.equal(
                describeClosedDay(series, series[i].date),
                null,
                `${symbol} ${series[i].date} is a trading day`
            );
        }
    }
});
