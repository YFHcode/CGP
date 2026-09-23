import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    downsample,
    sliceRange,
    recentTail,
    needsFullHistory,
    lastDrawn,
    thinRatio,
    RANGE_DAYS,
    RANGES,
    RECENT_POINTS,
    INDICATOR_WINDOW,
} from '../src/lib/chart-window.ts';

/**
 * The claim this module makes is strong: trimming on the server changes
 * nothing a visitor sees. So the tests do not check the helpers against
 * themselves. They check them against the chart code *as it shipped* —
 * reproduced below from git, before this change — run over the real price
 * history, and require identical output.
 */

const history = JSON.parse(readFileSync(new URL('../data/history.json', import.meta.url), 'utf8'));
const GOLD = history.series.XAU;
const SILVER = history.series.XAG;

const DAY = 24 * 60 * 60 * 1000;
const lastTime = new Date(GOLD.at(-1).date).getTime();

/**
 * Pinned clocks: just after the last close, half a day later (a visitor
 * between refreshes), across a weekend, and three weeks stale — the last is
 * the case where the date windows empty out and the tail fallback takes over.
 */
const CLOCKS = {
    'next morning': lastTime + 0.3 * DAY,
    'half a day on': lastTime + 0.8 * DAY,
    'over a weekend': lastTime + 3 * DAY,
    'three weeks stale': lastTime + 21 * DAY,
};

const SHORT_RANGES = RANGES.filter((r) => !needsFullHistory(RANGE_DAYS[r]));

// ---------------------------------------------------------------------------
// The shipped client logic, verbatim apart from `now` being a parameter.
// ---------------------------------------------------------------------------

function shippedDownsample(points, limit) {
    if (points.length <= limit) return points;
    const step = (points.length - 1) / (limit - 1);
    const thinned = [];
    for (let i = 0; i < limit; i += 1) thinned.push(points[Math.round(i * step)]);
    return thinned;
}

function shippedSliceRange(points, range, now) {
    if (points.length === 0) return [];
    const days = RANGE_DAYS[range];
    if (days === null) return points;
    const cutoff = now - days * DAY;
    const windowed = points.filter((point) => {
        const time = new Date(point.date).getTime();
        return Number.isFinite(time) && time >= cutoff;
    });
    return windowed.length >= 2 ? windowed : points.slice(-days);
}

function joinByDate(a, b) {
    const bByDate = new Map(b.map((p) => [p.date, p.close]));
    const joined = [];
    for (const point of a) {
        const bClose = bByDate.get(point.date);
        if (bClose !== undefined) joined.push({ date: point.date, a: point.close, b: bClose });
    }
    return joined;
}

/** ExploreChart's four views, as they shipped, minus the label formatting. */
function exploreViews(gold, silver, range, now, slice = shippedSliceRange, thin = shippedDownsample) {
    const price = thin(slice(gold, range, now), 400).map((p) => [p.date, p.close]);

    const joined = joinByDate(slice(gold, range, now), slice(silver, range, now));
    const base = joined[0];
    const compare = joined.length
        ? thin(joined, 400).map((p) => [p.date, (p.a / base.a - 1) * 100, (p.b / base.b - 1) * 100])
        : [];
    const ratio = thin(joined, 400).map((p) => [p.date, p.b > 0 ? p.a / p.b : 0]);

    const sliced = slice(gold, range, now);
    let change = [];
    if (sliced.length) {
        const startIndex = gold.findIndex((p) => p.date === sliced[0].date);
        const withLeading = startIndex > 0 ? [gold[startIndex - 1], ...sliced] : sliced;
        for (let i = 1; i < withLeading.length; i += 1) {
            const prev = withLeading[i - 1].close;
            change.push([withLeading[i].date, prev > 0 ? ((withLeading[i].close - prev) / prev) * 100 : 0]);
        }
        change = thin(change, 200);
    }

    return { price, compare, ratio, change };
}

// ---------------------------------------------------------------------------

test('fixtures are the real record, not a toy', () => {
    assert.ok(GOLD.length > 6000, `expected the full gold series, got ${GOLD.length}`);
    assert.ok(SILVER.length > 6000, `expected the full silver series, got ${SILVER.length}`);
});

test('downsample is the shipped algorithm', () => {
    for (const limit of [2, 3, 200, 400, 1000]) {
        assert.deepEqual(downsample(GOLD, limit), shippedDownsample(GOLD, limit), `limit ${limit}`);
    }
});

test('downsample is idempotent, which is what makes server trimming invisible', () => {
    const once = downsample(GOLD);
    assert.equal(once.length, 400);
    assert.deepEqual(downsample(once), once);
});

test('sliceRange is the shipped function', () => {
    for (const [clock, now] of Object.entries(CLOCKS)) {
        for (const range of RANGES) {
            assert.deepEqual(sliceRange(GOLD, range, now), shippedSliceRange(GOLD, range, now), `${range} at ${clock}`);
        }
    }
});

test('only 5Y, 10Y and MAX need the full record', () => {
    assert.deepEqual(
        RANGES.filter((r) => needsFullHistory(RANGE_DAYS[r])),
        ['5Y', '10Y', 'MAX']
    );
});

test('PriceChart: every short range draws identically from the recent tail', () => {
    const tail = recentTail(GOLD);
    assert.equal(tail.length, RECENT_POINTS);

    for (const [clock, now] of Object.entries(CLOCKS)) {
        for (const range of SHORT_RANGES) {
            const shipped = shippedDownsample(shippedSliceRange(GOLD, range, now), 400);
            const trimmed = downsample(sliceRange(tail, range, now));
            assert.deepEqual(trimmed, shipped, `${range} at ${clock}`);
        }
    }
});

test('ExploreChart: all four views draw identically from the recent tails', () => {
    // The daily-change view is the demanding one: it needs the close *before*
    // the window to compute the window's first bar, so the tail has to reach
    // past the 1Y cutoff. The compare and ratio views join the two metals on
    // date, so both tails have to cover the same span.
    const goldTail = recentTail(GOLD);
    const silverTail = recentTail(SILVER);

    for (const [clock, now] of Object.entries(CLOCKS)) {
        for (const range of SHORT_RANGES) {
            const shipped = exploreViews(GOLD, SILVER, range, now);
            const trimmed = exploreViews(goldTail, silverTail, range, now, sliceRange, downsample);
            for (const view of ['price', 'compare', 'ratio', 'change']) {
                assert.deepEqual(trimmed[view], shipped[view], `${view} ${range} at ${clock}`);
            }
        }
    }
});

test('negative control: a tail too short for 1Y is caught', () => {
    // If RECENT_POINTS were cut to ~250 trading days, 1Y would silently lose
    // its first weeks and daily-change its leading close. The equivalence
    // tests above must be able to see that happen.
    const tooShort = GOLD.slice(-200);
    const now = CLOCKS['next morning'];
    const shipped = exploreViews(GOLD, SILVER, '1Y', now);
    const broken = exploreViews(tooShort, SILVER.slice(-200), '1Y', now, sliceRange, downsample);
    assert.notDeepEqual(broken.price, shipped.price);
});

test('indicator panels: lastDrawn is the client filter-then-slice', () => {
    const rsi = GOLD.map((p, i) => ({ date: p.date, value: i < 14 ? null : p.close / 100 }));
    const drawable = (p) => p.value !== null;

    const shipped = rsi.filter(drawable).slice(-INDICATOR_WINDOW);
    const trimmed = lastDrawn(rsi, drawable);

    assert.deepEqual(trimmed, shipped);
    // and the client, re-applying its step to the trimmed data, changes nothing
    assert.deepEqual(trimmed.filter(drawable).slice(-INDICATOR_WINDOW), shipped);
});

test('ratio chart: thinned points and full-record mean reproduce the shipped chart', () => {
    const joined = joinByDate(GOLD, SILVER);
    const ratio = joined.map((p, i) => ({ date: p.date, value: i < 3 ? null : p.a / p.b }));

    // shipped RatioChart
    const all = ratio.filter((p) => p.value !== null);
    const step = Math.max(1, Math.ceil(all.length / 400));
    const shippedData = all.filter((_, i) => i % step === 0);
    const shippedMean = all.reduce((s, p) => s + p.value, 0) / all.length;

    const { points, mean } = thinRatio(ratio);
    assert.ok(points.length <= 400);
    assert.equal(mean, shippedMean);

    // the client re-running its thinning over the trimmed points: identity
    const again = points.filter((p) => p.value !== null);
    const step2 = Math.max(1, Math.ceil(again.length / 400));
    assert.equal(step2, 1);
    assert.deepEqual(again.filter((_, i) => i % step2 === 0), shippedData);
});

test('ratio chart: a mean from the thinned points would have been wrong', () => {
    // Negative control for passing the mean through separately.
    const joined = joinByDate(GOLD, SILVER);
    const ratio = joined.map((p) => ({ date: p.date, value: p.a / p.b }));
    const { points, mean } = thinRatio(ratio);
    const naive = points.reduce((s, p) => s + p.value, 0) / points.length;
    assert.notEqual(naive, mean);
});

test('thinRatio handles an empty series', () => {
    assert.deepEqual(thinRatio([]), { points: [], mean: null });
    assert.deepEqual(thinRatio([{ date: '2026-01-01', value: null }]), { points: [], mean: null });
});
