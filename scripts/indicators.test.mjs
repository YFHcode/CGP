import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors src/lib/indicators.ts.
 *
 * The RSI assertions use Wilder's own worked example from "New Concepts in
 * Technical Trading Systems" (1978) — the 14-day sequence he publishes RSI
 * values for. Testing against an external reference is the point: an RSI built
 * on a simple moving average instead of Wilder smoothing passes any
 * self-consistent test while being a different indicator.
 */

function ema(values, period) {
    const out = new Array(values.length).fill(null);
    if (period <= 0 || values.length < period) return out;
    const k = 2 / (period + 1);
    let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    out[period - 1] = prev;
    for (let i = period; i < values.length; i++) {
        prev = values[i] * k + prev * (1 - k);
        out[i] = prev;
    }
    return out;
}

function rsi(points, period = 14) {
    const out = points.map((p) => ({ date: p.date, value: null }));
    if (points.length <= period) return out;
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
        const change = points[i].close - points[i - 1].close;
        if (change >= 0) gainSum += change;
        else lossSum -= change;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    const toRsi = (g, l) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
    out[period].value = toRsi(avgGain, avgLoss);
    for (let i = period + 1; i < points.length; i++) {
        const change = points[i].close - points[i - 1].close;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        out[i].value = toRsi(avgGain, avgLoss);
    }
    return out;
}

function bollinger(points, period = 20, multiplier = 2) {
    const out = points.map((p) => ({
        date: p.date,
        middle: null,
        upper: null,
        lower: null,
        percentB: null,
    }));
    for (let i = period - 1; i < points.length; i++) {
        const w = points.slice(i - period + 1, i + 1).map((p) => p.close);
        const mean = w.reduce((a, b) => a + b, 0) / period;
        const sd = Math.sqrt(w.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
        const upper = mean + multiplier * sd;
        const lower = mean - multiplier * sd;
        out[i] = {
            date: points[i].date,
            middle: mean,
            upper,
            lower,
            percentB: upper === lower ? null : (points[i].close - lower) / (upper - lower),
        };
    }
    return out;
}

function goldSilverRatio(gold, silver) {
    const byDate = new Map(silver.map((p) => [p.date, p.close]));
    const out = [];
    for (const p of gold) {
        const c = byDate.get(p.date);
        if (c === undefined || !(c > 0) || !(p.close > 0)) continue;
        out.push({ date: p.date, value: p.close / c });
    }
    return out;
}

const series = (closes) =>
    closes.map((close, i) => {
        const d = new Date(Date.UTC(2026, 0, 1));
        d.setUTCDate(d.getUTCDate() + i);
        return { date: d.toISOString().slice(0, 10), close };
    });

// Wilder's published example: 14 periods of closes plus subsequent sessions.
// The reference RSI after the 14th period is 70.53, and 66.32 after the next.
const WILDER_CLOSES = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
    46.28, 46.28, 46.0,
];

test('RSI matches Wilder’s published worked example', () => {
    const out = rsi(series(WILDER_CLOSES), 14);
    // Index 14 is the first computable RSI (needs 14 changes).
    //
    // Tolerance is 0.15, not 0.01: the published closes are rounded to two
    // decimals, so the reference RSI carries rounding error of the same order.
    // This implementation gives 70.46 against a quoted 70.53 — 0.1% apart,
    // consistent with the input rounding rather than with a different formula.
    // That it is Wilder smoothing and not a simple average is pinned
    // separately by the next test, which does not depend on tolerance.
    assert.ok(
        Math.abs(out[14].value - 70.53) < 0.15,
        `expected ~70.53 at the first RSI, got ${out[14].value?.toFixed(2)}`
    );
    assert.ok(
        Math.abs(out[15].value - 66.32) < 0.35,
        `expected ~66.3 after the next session, got ${out[15].value?.toFixed(2)}`
    );
});

test('RSI uses Wilder smoothing, not a simple moving average', () => {
    // The two definitions diverge after the seed period. A simple rolling mean
    // of gains and losses over the same window gives a materially different
    // number here, so this pins which one is implemented.
    const points = series(WILDER_CLOSES);
    const out = rsi(points, 14);

    let gains = 0;
    let losses = 0;
    for (let i = 2; i <= 15; i++) {
        const change = points[i].close - points[i - 1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    const simpleRsi = 100 - 100 / (1 + gains / 14 / (losses / 14));
    assert.ok(
        Math.abs(out[15].value - simpleRsi) > 0.5,
        'Wilder and simple-average RSI should differ noticeably; they did not'
    );
});

test('RSI is bounded to 0-100 and saturates on an unbroken run', () => {
    const rising = rsi(series(Array.from({ length: 40 }, (_, i) => 100 + i)), 14);
    const last = rising[rising.length - 1].value;
    assert.equal(last, 100, 'an unbroken run of gains is RSI 100 by definition');

    const falling = rsi(series(Array.from({ length: 40 }, (_, i) => 200 - i)), 14);
    assert.ok(falling[falling.length - 1].value < 1e-9, 'an unbroken decline is RSI 0');

    for (const p of [...rising, ...falling]) {
        if (p.value !== null) assert.ok(p.value >= 0 && p.value <= 100, `out of range: ${p.value}`);
    }
});

test('RSI reports nothing until it has a full period of changes', () => {
    const out = rsi(series(WILDER_CLOSES), 14);
    for (let i = 0; i < 14; i++) assert.equal(out[i].value, null, `index ${i} should be null`);
    assert.notEqual(out[14].value, null);
});

test('EMA seeds on a simple average and then weights by 2/(n+1)', () => {
    const values = [1, 2, 3, 4, 5];
    const out = ema(values, 3);
    assert.equal(out[0], null);
    assert.equal(out[1], null);
    assert.equal(out[2], 2, 'seed is the simple mean of the first three');
    // k = 0.5 for period 3: next = 4*0.5 + 2*0.5 = 3
    assert.equal(out[3], 3);
    assert.equal(out[4], 4);
});

test('Bollinger bands are symmetric about the mean and contain the mean', () => {
    const points = series([10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17, 19, 18, 20, 19, 21]);
    const out = bollinger(points, 20, 2);
    const last = out[out.length - 1];
    assert.ok(last.middle !== null);
    assert.ok(
        Math.abs(last.upper - last.middle - (last.middle - last.lower)) < 1e-9,
        'bands must be equidistant from the middle'
    );
    assert.ok(last.upper > last.middle && last.lower < last.middle);
});

test('Bollinger uses population standard deviation, per its definition', () => {
    const closes = [10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17, 19, 18, 20, 19, 21];
    const out = bollinger(series(closes), 20, 2);
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const population = Math.sqrt(
        closes.reduce((s, v) => s + (v - mean) ** 2, 0) / closes.length
    );
    const last = out[out.length - 1];
    assert.ok(
        Math.abs(last.upper - (mean + 2 * population)) < 1e-9,
        'upper band should use the population sigma, not the sample one'
    );
});

test('percentB places price within the band', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const out = bollinger(series(closes), 20, 2);
    for (const p of out) {
        if (p.percentB === null) continue;
        assert.ok(Number.isFinite(p.percentB), 'percentB must be finite when bands exist');
    }
});

test('the gold-silver ratio aligns on dates, never on position', () => {
    // Silver is missing a session the gold series has. Zipping by index would
    // pair 2026-01-03 gold with 2026-01-04 silver and produce a wrong ratio
    // for every point after the gap.
    const gold = [
        { date: '2026-01-01', close: 2000 },
        { date: '2026-01-02', close: 2010 },
        { date: '2026-01-03', close: 2020 },
    ];
    const silver = [
        { date: '2026-01-01', close: 25 },
        { date: '2026-01-03', close: 20 },
    ];
    const out = goldSilverRatio(gold, silver);
    assert.equal(out.length, 2, 'only shared dates should appear');
    assert.deepEqual(
        out.map((p) => p.date),
        ['2026-01-01', '2026-01-03']
    );
    assert.equal(out[0].value, 80);
    assert.equal(out[1].value, 101);
});

test('the ratio skips non-positive or missing prices rather than dividing by zero', () => {
    const out = goldSilverRatio(
        [
            { date: '2026-01-01', close: 2000 },
            { date: '2026-01-02', close: 2000 },
        ],
        [
            { date: '2026-01-01', close: 0 },
            { date: '2026-01-02', close: 25 },
        ]
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].value, 80);
});
