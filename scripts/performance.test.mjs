import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Mirrors src/lib/performance.ts.
 *
 * The interesting failures here are all about anchoring, not arithmetic: a
 * horizon silently measured from the wrong date still produces a plausible
 * percentage, which is exactly the kind of wrong number nobody notices. So the
 * binary search is checked against a brute-force scan, the percentages against
 * values worked out by hand, and the whole thing against the real series.
 */

const HORIZONS = [
    { key: '1w', label: '1 week', days: 7 },
    { key: '1m', label: '1 month', days: 30 },
    { key: '6m', label: '6 months', days: 182 },
    { key: '1y', label: '1 year', days: 365 },
    { key: '5y', label: '5 years', days: 1826 },
    { key: '10y', label: '10 years', days: 3653 },
];

function maxAnchorDrift(horizonDays) {
    return Math.max(4, Math.ceil(horizonDays * 0.02));
}

const toUtc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const daysBetween = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
const shiftDays = (iso, d) => new Date(toUtc(iso) + d * 86_400_000).toISOString().slice(0, 10);

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

function buildReturn(spec, from, to, drift) {
    if (!(from.close > 0) || !Number.isFinite(to.close)) return null;
    return {
        key: spec.key,
        label: spec.label,
        changeAbs: to.close - from.close,
        changePct: ((to.close - from.close) / from.close) * 100,
        fromDate: from.date,
        fromClose: from.close,
        toDate: to.date,
        toClose: to.close,
        anchorDriftDays: drift,
    };
}

function horizonReturns(points) {
    if (points.length < 2) return [];
    const latest = points[points.length - 1];
    const rows = [];

    const previous = points[points.length - 2];
    const oneDay = buildReturn(
        { key: '1d', label: '1 day' },
        previous,
        latest,
        Math.max(0, daysBetween(previous.date, latest.date) - 1)
    );
    if (oneDay) rows.push(oneDay);

    for (const spec of HORIZONS) {
        const target = shiftDays(latest.date, -spec.days);
        const index = indexOnOrBefore(points, target);
        if (index < 0) continue;
        const anchor = points[index];
        const drift = daysBetween(anchor.date, target);
        if (drift > maxAnchorDrift(spec.days)) continue;
        const row = buildReturn(spec, anchor, latest, drift);
        if (row) rows.push(row);
    }

    const yearStart = `${latest.date.slice(0, 4)}-01-01`;
    const ytdIndex = indexOnOrBefore(points, shiftDays(yearStart, -1));
    if (ytdIndex >= 0) {
        const row = buildReturn({ key: 'ytd', label: 'Year to date' }, points[ytdIndex], latest, 0);
        if (row) rows.push(row);
    }

    const first = points[0];
    if (first.date !== latest.date) {
        const row = buildReturn(
            { key: 'all', label: `Since ${first.date.slice(0, 4)}` },
            first,
            latest,
            0
        );
        if (row) rows.push(row);
    }
    return rows;
}

function seriesExtremes(points) {
    if (points.length === 0) return null;
    let high = points[0];
    let low = points[0];
    for (const point of points) {
        if (point.close > high.close) high = point;
        if (point.close < low.close) low = point;
    }
    const latest = points[points.length - 1];
    return {
        latest,
        previous: points.length > 1 ? points[points.length - 2] : null,
        high,
        low,
        first: points[0],
        count: points.length,
        belowHighPct: high.close > 0 ? ((high.close - latest.close) / high.close) * 100 : 0,
    };
}

// --- helpers for building fixtures -------------------------------------------

/** Consecutive calendar days, so anchor maths is easy to reason about. */
function dailySeries(startIso, closes) {
    return closes.map((close, i) => ({ date: shiftDays(startIso, i), close }));
}

const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.key, r]));

// --- tests --------------------------------------------------------------------

test('the binary search agrees with a brute-force scan', () => {
    // External truth: the obvious O(n) implementation, over a deliberately
    // gappy series and including targets before, inside and after its range.
    const points = [
        '2020-01-01', '2020-01-02', '2020-01-07', '2020-02-01',
        '2020-02-02', '2020-06-15', '2021-01-01', '2021-12-31',
    ].map((date, i) => ({ date, close: 100 + i }));

    const brute = (target) => {
        let found = -1;
        for (let i = 0; i < points.length; i++) if (points[i].date <= target) found = i;
        return found;
    };

    for (let d = 0; d < 900; d++) {
        const target = shiftDays('2019-12-25', d);
        assert.equal(indexOnOrBefore(points, target), brute(target), `mismatch at ${target}`);
    }
});

test('percentages match values worked out by hand', () => {
    // 100 -> 150 is +50%; 100 -> 75 is -25%.
    const up = dailySeries('2026-01-01', [100, 150]);
    assert.equal(byKey(horizonReturns(up))['1d'].changePct, 50);
    assert.equal(byKey(horizonReturns(up))['1d'].changeAbs, 50);

    const down = dailySeries('2026-01-01', [100, 75]);
    assert.equal(byKey(horizonReturns(down))['1d'].changePct, -25);
});

test('1 day means the previous session, not the previous calendar day', () => {
    // Friday then Monday: the "1 day" change is Friday close -> Monday close,
    // and the drift field records that two calendar days were skipped.
    const points = [
        { date: '2026-08-21', close: 100 },
        { date: '2026-08-24', close: 110 },
    ];
    const row = byKey(horizonReturns(points))['1d'];
    assert.equal(row.fromDate, '2026-08-21');
    assert.equal(row.changePct, 10);
    assert.equal(row.anchorDriftDays, 2);
});

test('an anchor falling in a hole too large for the horizon is dropped', () => {
    // 400 consecutive days, then the 1-month anchor is removed by cutting a
    // 20-day hole where it would land. 20 > maxAnchorDrift(30) = 4, so the
    // row must disappear rather than silently measure a 50-day change.
    const full = dailySeries('2025-01-01', Array.from({ length: 400 }, (_, i) => 100 + i));
    const latest = full[full.length - 1].date;
    const holeStart = shiftDays(latest, -45);
    const holeEnd = shiftDays(latest, -25);
    const gapped = full.filter((p) => p.date < holeStart || p.date > holeEnd);

    assert.ok(byKey(horizonReturns(full))['1m'], 'the dense series should have a 1-month row');
    assert.equal(byKey(horizonReturns(gapped))['1m'], undefined);
    // The 1-year row is unaffected: its anchor is nowhere near the hole.
    assert.ok(byKey(horizonReturns(gapped))['1y']);
});

test('a hole small enough for a long horizon is tolerated and reported', () => {
    // maxAnchorDrift(1826) is 37 days, so a 10-day gap at the five-year mark
    // is accepted — but anchorDriftDays must say how far off it landed.
    const full = dailySeries('2015-01-01', Array.from({ length: 4200 }, (_, i) => 100 + i * 0.1));
    const latest = full[full.length - 1].date;
    const target = shiftDays(latest, -1826);
    const gapped = full.filter((p) => p.date > target || p.date <= shiftDays(target, -10));

    const row = byKey(horizonReturns(gapped))['5y'];
    assert.ok(row, 'a 10-day gap should not drop the five-year row');
    assert.equal(row.anchorDriftDays, 10);
    assert.equal(row.fromDate, shiftDays(target, -10));
});

test('horizons the series cannot reach are omitted, not zeroed', () => {
    const short = dailySeries('2026-01-01', Array.from({ length: 40 }, (_, i) => 100 + i));
    const rows = byKey(horizonReturns(short));
    assert.ok(rows['1w'], '1 week is reachable in 40 days');
    assert.ok(rows['1m'], '1 month is reachable in 40 days');
    for (const key of ['6m', '1y', '5y', '10y']) {
        assert.equal(rows[key], undefined, `${key} should be absent from a 40-day series`);
    }
});

test('year to date is anchored on the last close of the previous year', () => {
    const points = [
        { date: '2025-12-29', close: 200 },
        { date: '2025-12-31', close: 250 },
        { date: '2026-01-02', close: 300 },
        { date: '2026-03-01', close: 500 },
    ];
    const row = byKey(horizonReturns(points))['ytd'];
    assert.equal(row.fromDate, '2025-12-31', 'must use the final close of the old year');
    assert.equal(row.changePct, 100); // 250 -> 500
});

test('year to date is absent when the record starts inside the current year', () => {
    const points = dailySeries('2026-02-01', [100, 110, 120]);
    assert.equal(byKey(horizonReturns(points))['ytd'], undefined);
});

test('the full-record row is labelled with the real first year', () => {
    const points = dailySeries('2003-05-06', [100, 120]);
    const row = byKey(horizonReturns(points))['all'];
    assert.equal(row.label, 'Since 2003');
    assert.equal(row.fromDate, '2003-05-06');
    // Deliberately not "all time": the record starts where the data starts.
    assert.ok(!/all[- ]?time/i.test(row.label));
});

test('a record that is only matched later keeps its original date', () => {
    // A tie is not a new record, matching the rule day-character.ts follows.
    const points = [
        { date: '2026-01-01', close: 100 },
        { date: '2026-01-02', close: 150 },
        { date: '2026-01-03', close: 120 },
        { date: '2026-01-04', close: 150 },
    ];
    const extremes = seriesExtremes(points);
    assert.equal(extremes.high.date, '2026-01-02');
    assert.equal(extremes.high.close, 150);
});

test('extremes report the standing against the record high', () => {
    const points = [
        { date: '2026-01-01', close: 100 },
        { date: '2026-01-02', close: 200 },
        { date: '2026-01-03', close: 150 },
    ];
    const extremes = seriesExtremes(points);
    assert.equal(extremes.low.close, 100);
    assert.equal(extremes.high.close, 200);
    assert.equal(extremes.belowHighPct, 25); // 150 is 25% below 200
    assert.equal(extremes.previous.date, '2026-01-02');
});

test('a series sitting at its record reports zero below the high', () => {
    const points = dailySeries('2026-01-01', [100, 200]);
    assert.equal(seriesExtremes(points).belowHighPct, 0);
});

test('degenerate inputs return nothing rather than throwing', () => {
    assert.deepEqual(horizonReturns([]), []);
    assert.deepEqual(horizonReturns([{ date: '2026-01-01', close: 100 }]), []);
    assert.equal(seriesExtremes([]), null);
});

test('a zero or negative anchor close cannot produce an infinite return', () => {
    const points = [
        { date: '2026-01-01', close: 0 },
        { date: '2026-01-02', close: 100 },
    ];
    for (const row of horizonReturns(points)) {
        assert.ok(Number.isFinite(row.changePct), `${row.key} produced ${row.changePct}`);
    }
});

function dayChangePct(quote, series) {
    if (quote && Number.isFinite(quote.price) && quote.price > 0) {
        const previous = quote.prev_close_price;
        const hasRealPrevious =
            Number.isFinite(previous) && previous > 0 && previous !== quote.price;
        if (hasRealPrevious) {
            return Number.isFinite(quote.chp) && quote.chp !== 0
                ? quote.chp
                : ((quote.price - previous) / previous) * 100;
        }
        if (series.length >= 2) {
            const baseline = series[series.length - 2].close;
            if (baseline > 0) return ((quote.price - baseline) / baseline) * 100;
        }
        return null;
    }
    if (series.length >= 2) {
        const baseline = series[series.length - 2].close;
        const latest = series[series.length - 1].close;
        if (baseline > 0 && Number.isFinite(latest)) {
            return ((latest - baseline) / baseline) * 100;
        }
    }
    return null;
}

test('a quote carrying a real previous close is used as-is', () => {
    const quote = { price: 4453.87, chp: -3.21, prev_close_price: 4601.56 };
    assert.equal(dayChangePct(quote, []), -3.21);
});

test('a flat quote from the keyless provider falls back to the series', () => {
    // The exact shape platinum and palladium arrive in: prev_close equal to
    // price, ch and chp both zero. Reporting 0.00% here would state that the
    // metal did not move, which is a fabricated fact rather than a missing one.
    const quote = { price: 1443, chp: 0, prev_close_price: 1443 };
    const series = [
        { date: '2026-08-27', close: 1337.5 },
        { date: '2026-08-28', close: 1442.5 },
    ];
    const change = dayChangePct(quote, series);
    assert.ok(change !== null, 'a usable series should rescue the row');
    assert.ok(Math.abs(change - 7.888) < 0.01, `expected about +7.9%, got ${change}`);
});

test('a flat quote with no usable series yields null rather than a false zero', () => {
    const quote = { price: 1443, chp: 0, prev_close_price: 1443 };
    assert.equal(dayChangePct(quote, []), null);
    assert.equal(dayChangePct(quote, [{ date: '2026-08-28', close: 1443 }]), null);
});

test('a genuine zero move is preserved rather than treated as missing', () => {
    // prev_close differs from price only in that it does not: the discriminator
    // is whether the provider gave a distinct previous close, so an unchanged
    // day still reports through the series rather than vanishing.
    const series = [
        { date: '2026-08-27', close: 100 },
        { date: '2026-08-28', close: 100 },
    ];
    assert.equal(dayChangePct({ price: 100, chp: 0, prev_close_price: 100 }, series), 0);
});

test('a missing quote falls back to close-to-close', () => {
    const series = [
        { date: '2026-08-27', close: 200 },
        { date: '2026-08-28', close: 220 },
    ];
    assert.equal(dayChangePct(null, series), 10);
});

test('every metal in the snapshot yields a day change or an explicit null', () => {
    const prices = JSON.parse(readFileSync(new URL('../data/prices.json', import.meta.url), 'utf8'));
    const hist = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));
    for (const [symbol, quote] of Object.entries(prices.metals)) {
        const change = dayChangePct(quote, hist.series[symbol] ?? []);
        assert.ok(
            change === null || Number.isFinite(change),
            `${symbol} produced ${change}`
        );
        // None of the four should be reporting a suspicious exact zero, which
        // is what the provider's placeholder used to render as.
        if (quote.prev_close_price === quote.price) {
            assert.notEqual(change, 0, `${symbol} still reports a placeholder zero`);
        }
    }
});

// --- against the real series --------------------------------------------------

const history = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));

test('every metal in the snapshot produces a full, finite table', () => {
    for (const [symbol, series] of Object.entries(history.series)) {
        const rows = horizonReturns(series);
        assert.ok(rows.length >= 8, `${symbol} produced only ${rows.length} rows`);
        for (const row of rows) {
            assert.ok(Number.isFinite(row.changePct), `${symbol} ${row.key} is not finite`);
            assert.ok(row.fromDate < row.toDate, `${symbol} ${row.key} anchor is not earlier`);
            assert.ok(
                row.anchorDriftDays >= 0 && row.anchorDriftDays <= 74,
                `${symbol} ${row.key} drifted ${row.anchorDriftDays} days`
            );
        }
    }
});

test('the real year-to-date figure matches an independent calculation', () => {
    // External truth: recompute YTD by filtering rather than by anchoring.
    for (const [symbol, series] of Object.entries(history.series)) {
        const latest = series[series.length - 1];
        const year = latest.date.slice(0, 4);
        const priorYear = series.filter((p) => p.date < `${year}-01-01`);
        if (priorYear.length === 0) continue;
        const base = priorYear[priorYear.length - 1].close;
        const expected = ((latest.close - base) / base) * 100;

        const row = horizonReturns(series).find((r) => r.key === 'ytd');
        assert.ok(row, `${symbol} should have a YTD row`);
        assert.ok(
            Math.abs(row.changePct - expected) < 1e-9,
            `${symbol} YTD ${row.changePct} vs ${expected}`
        );
    }
});

test('the real record high is not beaten by any close in the series', () => {
    for (const [symbol, series] of Object.entries(history.series)) {
        const { high, low } = seriesExtremes(series);
        for (const point of series) {
            assert.ok(point.close <= high.close, `${symbol}: ${point.date} exceeds the record high`);
            assert.ok(point.close >= low.close, `${symbol}: ${point.date} is below the record low`);
        }
    }
});
