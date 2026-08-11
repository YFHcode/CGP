/**
 * Tests for the extended period statistics in src/lib/period-insights.ts.
 *
 * These figures are stated as fact across every indexable archive page, so an
 * error here is a site-wide factual error. Source is TypeScript; logic mirrored
 * here in plain JS. Keep in sync.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const GRAMS_PER_OZ = 31.1034768;
const GRAMS_PER_KG = 1000;
const KARATS = ['24K', '22K', '21K', '18K', '14K', '10K'];
const KARAT_PURITY = {
    '24K': 1, '22K': 22 / 24, '21K': 21 / 24,
    '18K': 18 / 24, '14K': 14 / 24, '10K': 10 / 24,
};

function stdDev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}

function closeOnOrBefore(points, target) {
    let found = null;
    for (const p of points) {
        if (p.date <= target) found = p.close;
        else break;
    }
    return found;
}

function shiftIsoDate(iso, delta) {
    let [y, m, d] = iso.split('-').map(Number);
    if (delta.months) {
        const total = m - 1 + delta.months;
        y += Math.floor(total / 12);
        m = ((total % 12) + 12) % 12 + 1;
        d = Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate());
    }
    const date = new Date(Date.UTC(y, m - 1, d));
    if (delta.days) date.setUTCDate(date.getUTCDate() + delta.days);
    return date.toISOString().slice(0, 10);
}

function computeInsights(stats, fullSeries, otherSeries, metal) {
    const points = stats.points;
    const returns = [];
    let upDays = 0, downDays = 0, flatDays = 0, bestDay = null, worstDay = null;

    let previous = stats.previousClose;
    for (const point of points) {
        if (previous !== null && previous > 0) {
            const pct = ((point.close - previous) / previous) * 100;
            returns.push(pct);
            if (pct > 0) upDays += 1; else if (pct < 0) downDays += 1; else flatDays += 1;
            if (!bestDay || pct > bestDay.pct) bestDay = { date: point.date, pct };
            if (!worstDay || pct < worstDay.pct) worstDay = { date: point.date, pct };
        }
        previous = point.close;
    }

    const otherByDate = new Map(otherSeries.map((p) => [p.date, p.close]));
    const ratios = [];
    for (const point of points) {
        const other = otherByDate.get(point.date);
        if (!other || other <= 0 || point.close <= 0) continue;
        ratios.push(metal === 'XAU' ? point.close / other : other / point.close);
    }
    const lastOther = otherByDate.get(points[points.length - 1].date);
    const ratioClose = lastOther && lastOther > 0
        ? (metal === 'XAU' ? stats.close / lastOther : lastOther / stats.close)
        : null;

    const [y, m, d] = stats.period.end.split('-');
    const yearAgoClose = closeOnOrBefore(fullSeries, `${Number(y) - 1}-${m}-${d}`);
    const monthAgoClose = closeOnOrBefore(fullSeries, shiftIsoDate(stats.period.end, { months: -1 }));
    const weekAgoClose = closeOnOrBefore(fullSeries, shiftIsoDate(stats.period.end, { days: -7 }));
    const changePctFrom = (ref) => (ref && ref > 0 ? ((stats.close - ref) / ref) * 100 : null);

    return {
        upDays, downDays, flatDays, bestDay, worstDay,
        rangePct: stats.low > 0 ? ((stats.high - stats.low) / stats.low) * 100 : 0,
        volatilityPct: stdDev(returns),
        perGram: stats.close / GRAMS_PER_OZ,
        perKilo: (stats.close / GRAMS_PER_OZ) * GRAMS_PER_KG,
        perGramByKarat: KARATS.map((k) => ({
            karat: k, purity: KARAT_PURITY[k],
            value: (stats.close / GRAMS_PER_OZ) * KARAT_PURITY[k],
        })),
        ratioClose,
        ratioAverage: ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : null,
        yearAgoClose,
        yearAgoChangePct: changePctFrom(yearAgoClose),
        monthAgoClose,
        monthAgoChangePct: changePctFrom(monthAgoClose),
        weekAgoClose,
        weekAgoChangePct: changePctFrom(weekAgoClose),
    };
}

const gold = [
    { date: '2025-03-10', close: 2000 },
    { date: '2026-03-08', close: 4000 },
    { date: '2026-03-09', close: 4100 },
    { date: '2026-03-10', close: 3900 },
    { date: '2026-03-11', close: 4200 },
];
const silver = [
    { date: '2026-03-08', close: 50 },
    { date: '2026-03-09', close: 52 },
    { date: '2026-03-10', close: 48 },
    { date: '2026-03-11', close: 60 },
];

const stats = {
    period: { kind: 'month', label: 'March 2026', key: '2026-03', start: '2026-03-01', end: '2026-03-31' },
    points: gold.slice(1),
    close: 4200, high: 4200, low: 3900, average: 4050,
    highDate: '2026-03-11', lowDate: '2026-03-10',
    change: 200, changePct: 5, previousClose: 4000,
};

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('counts higher and lower closes against the prior session', () => {
    const i = computeInsights(stats, gold, silver, 'XAU');
    // 4000 vs prev 4000 = flat, 4100 up, 3900 down, 4200 up
    assert.equal(i.upDays, 2);
    assert.equal(i.downDays, 1);
    assert.equal(i.flatDays, 1);
});

test('identifies the best and worst sessions', () => {
    const i = computeInsights(stats, gold, silver, 'XAU');
    assert.equal(i.bestDay.date, '2026-03-11');
    close(i.bestDay.pct, ((4200 - 3900) / 3900) * 100, 1e-9);
    assert.equal(i.worstDay.date, '2026-03-10');
    assert.ok(i.worstDay.pct < 0);
});

test('per-gram and per-kilo derive from the exact troy ounce', () => {
    const i = computeInsights(stats, gold, silver, 'XAU');
    close(i.perGram, 4200 / GRAMS_PER_OZ);
    close(i.perKilo, (4200 / GRAMS_PER_OZ) * GRAMS_PER_KG);
    close(i.perKilo, i.perGram * 1000);
});

test('karat melt values scale by purity', () => {
    const i = computeInsights(stats, gold, silver, 'XAU');
    const byKarat = Object.fromEntries(i.perGramByKarat.map((k) => [k.karat, k.value]));
    close(byKarat['24K'], 4200 / GRAMS_PER_OZ);
    close(byKarat['18K'], (4200 / GRAMS_PER_OZ) * 0.75);
    close(byKarat['14K'] / byKarat['24K'], 14 / 24);
});

test('gold to silver ratio is always gold over silver, on either page', () => {
    const fromGold = computeInsights(stats, gold, silver, 'XAU');
    close(fromGold.ratioClose, 4200 / 60);

    const silverStats = {
        ...stats,
        points: silver,
        close: 60, high: 60, low: 48, previousClose: 50,
    };
    const fromSilver = computeInsights(silverStats, silver, gold, 'XAG');
    close(fromSilver.ratioClose, 4200 / 60, 1e-6);
});

test('range and volatility are reported as percentages', () => {
    const i = computeInsights(stats, gold, silver, 'XAU');
    close(i.rangePct, ((4200 - 3900) / 3900) * 100, 1e-9);
    assert.ok(i.volatilityPct > 0, 'a moving series has non-zero volatility');
});

test('year-ago comparison resolves to the nearest earlier session', () => {
    // 2025-03-31 has no point; the 2025-03-10 close should be used.
    const i = computeInsights(stats, gold, silver, 'XAU');
    assert.equal(i.yearAgoClose, 2000);
    close(i.yearAgoChangePct, ((4200 - 2000) / 2000) * 100, 1e-9);
});

test('missing counterpart data yields null rather than a wrong number', () => {
    const i = computeInsights(stats, gold, [], 'XAU');
    assert.equal(i.ratioClose, null);
    assert.equal(i.ratioAverage, null);
});

test('no earlier history yields a null year-ago comparison', () => {
    const i = computeInsights(stats, gold.slice(1), silver, 'XAU');
    assert.equal(i.yearAgoClose, null);
    assert.equal(i.yearAgoChangePct, null);
});

test('week-ago comparison resolves to the nearest earlier session', () => {
    const i = computeInsights(stats, gold, silver, 'XAU');
    // period.end is 2026-03-31; a week earlier is 2026-03-24 (no point, falls
    // back to the latest point on or before it: 2026-03-11 at 4200).
    assert.equal(i.weekAgoClose, 4200);
    close(i.weekAgoChangePct, 0, 1e-9);
});

test('month-ago comparison clamps into the shorter month rather than overflowing', () => {
    // period.end is 2026-03-31; "a month before" must be 2026-02-28 (Feb has
    // no 31st), not overflow forward into March.
    assert.equal(shiftIsoDate('2026-03-31', { months: -1 }), '2026-02-28');
    // Nothing in `gold` falls in Jan/Feb 2026, so this resolves all the way
    // back to the 2025-03-10 point rather than being null.
    const i = computeInsights(stats, gold, silver, 'XAU');
    assert.equal(i.monthAgoClose, 2000);
    close(i.monthAgoChangePct, ((4200 - 2000) / 2000) * 100, 1e-9);
});

test('a single-point period does not produce NaN volatility', () => {
    const single = { ...stats, points: [{ date: '2026-03-11', close: 4200 }], previousClose: null };
    const i = computeInsights(single, gold, silver, 'XAU');
    assert.ok(Number.isFinite(i.volatilityPct));
    assert.equal(i.volatilityPct, 0);
});
