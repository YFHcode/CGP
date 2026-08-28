import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Mirrors src/lib/live-quote.ts and the hasRangeData guard it depends on. */

const GRAMS_PER_OZ = 31.1034768;
const hasRangeData = (d) => d.high_price !== d.low_price;

function mergeLiveQuote(base, livePrice) {
    if (typeof livePrice !== 'number' || !Number.isFinite(livePrice) || livePrice <= 0) {
        return base;
    }
    const prevClose = base.prev_close_price;
    const canComputeChange =
        typeof prevClose === 'number' && Number.isFinite(prevClose) && prevClose > 0;
    const ch = canComputeChange ? livePrice - prevClose : base.ch;
    const chp = canComputeChange ? (ch / prevClose) * 100 : base.chp;
    const keepsRange = hasRangeData(base);
    const high = keepsRange ? Math.max(base.high_price, livePrice) : livePrice;
    const low = keepsRange ? Math.min(base.low_price, livePrice) : livePrice;
    const perGram = livePrice / GRAMS_PER_OZ;
    return {
        ...base,
        price: livePrice,
        ch,
        chp,
        high_price: high,
        low_price: low,
        ask: livePrice,
        bid: livePrice,
        price_gram_24k: perGram,
        price_gram_22k: perGram * (22 / 24),
        price_gram_18k: perGram * (18 / 24),
    };
}

const rich = {
    price: 4400,
    prev_close_price: 4300,
    high_price: 4420,
    low_price: 4380,
    ch: 100,
    chp: 2.3256,
    ask: 4400,
    bid: 4400,
};

// The keyless fallback's shape: no range, no change, deliberately flat.
const flat = {
    price: 4400,
    prev_close_price: 4400,
    high_price: 4400,
    low_price: 4400,
    ch: 0,
    chp: 0,
    ask: 4400,
    bid: 4400,
};

test('change is recomputed against the previous close, not carried over', () => {
    const m = mergeLiveQuote(rich, 4350);
    assert.equal(m.price, 4350);
    assert.equal(m.ch, 50, 'change should be live price minus previous close');
    assert.ok(Math.abs(m.chp - (50 / 4300) * 100) < 1e-9);
});

test('a live price below the previous close yields a negative change', () => {
    const m = mergeLiveQuote(rich, 4250);
    assert.equal(m.ch, -50);
    assert.ok(m.chp < 0);
});

test('the day range widens only when the live price breaks it', () => {
    const inside = mergeLiveQuote(rich, 4400);
    assert.equal(inside.high_price, 4420, 'high unchanged when price is inside the range');
    assert.equal(inside.low_price, 4380, 'low unchanged when price is inside the range');

    const above = mergeLiveQuote(rich, 4500);
    assert.equal(above.high_price, 4500, 'high must follow a price that exceeds it');
    assert.equal(above.low_price, 4380);

    const below = mergeLiveQuote(rich, 4300);
    assert.equal(below.low_price, 4300);
    assert.equal(below.high_price, 4420);
});

test('the live price is never outside the reported day range', () => {
    for (const p of [4000, 4390, 4400, 4410, 5000]) {
        const m = mergeLiveQuote(rich, p);
        assert.ok(
            m.price <= m.high_price && m.price >= m.low_price,
            `price ${p} fell outside range ${m.low_price}-${m.high_price}`
        );
    }
});

test('a snapshot with no real range stays range-less rather than inventing one', () => {
    const m = mergeLiveQuote(flat, 4500);
    assert.equal(
        hasRangeData(m),
        false,
        'merging must not manufacture a day range from a flat fallback quote'
    );
    assert.equal(m.high_price, m.low_price);
    assert.equal(m.high_price, 4500);
});

test('per-gram figures track the live price and respect karat purity', () => {
    const m = mergeLiveQuote(rich, 4666.02);
    assert.ok(Math.abs(m.price_gram_24k - 4666.02 / GRAMS_PER_OZ) < 1e-9);
    // 22K is 22/24 of pure by definition of karat.
    assert.ok(Math.abs(m.price_gram_22k / m.price_gram_24k - 22 / 24) < 1e-12);
    assert.ok(Math.abs(m.price_gram_18k / m.price_gram_24k - 0.75) < 1e-12);
});

test('a missing or nonsensical live price leaves the snapshot untouched', () => {
    for (const bad of [null, undefined, NaN, 0, -1, Infinity, '4400']) {
        assert.equal(mergeLiveQuote(rich, bad), rich, `expected passthrough for ${String(bad)}`);
    }
});
