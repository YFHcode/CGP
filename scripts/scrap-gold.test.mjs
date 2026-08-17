/**
 * Tests for the scrap valuation maths in src/lib/scrap-gold.ts.
 *
 * Source is TypeScript; logic mirrored here in plain JS, matching the
 * convention in conversions.test.mjs. Keep the two in sync — these guard
 * numbers someone may walk into a shop holding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const GRAMS_PER_OZ = 31.1034768;
const GRAMS_PER_KG = 1000;

const convertToGrams = (value, unit) =>
    unit === 'oz' ? value * GRAMS_PER_OZ : unit === 'kg' ? value * GRAMS_PER_KG : value;

const SCRAP_KARAT_PURITY = {
    '9K': 9 / 24,
    '10K': 10 / 24,
    '14K': 14 / 24,
    '18K': 18 / 24,
    '21K': 21 / 24,
    '22K': 22 / 24,
    '24K': 1,
};

function valueScrapGold(spotPerOz, weight, unit, karat, buyer) {
    const empty = { pureGrams: 0, melt: 0, payoutLow: 0, payoutHigh: 0 };
    if (!Number.isFinite(spotPerOz) || spotPerOz <= 0) return empty;
    if (!Number.isFinite(weight) || weight <= 0) return empty;

    const grams = convertToGrams(weight, unit);
    const purity = SCRAP_KARAT_PURITY[karat] ?? 0;
    const pureGrams = grams * purity;
    const melt = (spotPerOz / GRAMS_PER_OZ) * pureGrams;

    return { pureGrams, melt, payoutLow: melt * buyer.low, payoutHigh: melt * buyer.high };
}

const JEWELLER = { low: 0.75, high: 0.9 };
const REFINER = { low: 0.9, high: 0.95 };

test('a troy ounce of 24K scrap is worth exactly spot at melt', () => {
    const v = valueScrapGold(4000, 1, 'oz', '24K', JEWELLER);
    assert.ok(Math.abs(v.melt - 4000) < 1e-6);
    assert.ok(Math.abs(v.pureGrams - GRAMS_PER_OZ) < 1e-9);
});

test('14K melt is 14/24 of the pure value for the same weight', () => {
    const pure = valueScrapGold(4000, 10, 'gram', '24K', JEWELLER);
    const fourteen = valueScrapGold(4000, 10, 'gram', '14K', JEWELLER);
    assert.ok(Math.abs(fourteen.melt - pure.melt * (14 / 24)) < 1e-9);
});

test('9K purity is exactly the 375 hallmark', () => {
    // The UK scrap staple. 9/24 is exactly 0.375, so karat and hallmark agree
    // here even though they diverge at 14K (0.5833 vs 585).
    assert.equal(SCRAP_KARAT_PURITY['9K'], 0.375);
});

test('payout is melt scaled by the buyer band, never above melt', () => {
    const v = valueScrapGold(4000, 1, 'oz', '24K', JEWELLER);
    assert.ok(Math.abs(v.payoutLow - 4000 * 0.75) < 1e-6);
    assert.ok(Math.abs(v.payoutHigh - 4000 * 0.9) < 1e-6);
    assert.ok(v.payoutHigh <= v.melt, 'no buyer band may exceed melt value');
});

test('a refiner pays more than a jeweller for the same lot', () => {
    const j = valueScrapGold(4000, 50, 'gram', '14K', JEWELLER);
    const r = valueScrapGold(4000, 50, 'gram', '14K', REFINER);
    assert.ok(r.payoutLow > j.payoutLow);
    assert.ok(r.payoutHigh > j.payoutHigh);
});

test('weight units scale melt consistently', () => {
    const oneOz = valueScrapGold(4000, 1, 'oz', '18K', JEWELLER);
    const inGrams = valueScrapGold(4000, GRAMS_PER_OZ, 'gram', '18K', JEWELLER);
    assert.ok(Math.abs(oneOz.melt - inGrams.melt) < 1e-6);

    const oneKg = valueScrapGold(4000, 1, 'kg', '18K', JEWELLER);
    const thousandGrams = valueScrapGold(4000, 1000, 'gram', '18K', JEWELLER);
    assert.ok(Math.abs(oneKg.melt - thousandGrams.melt) < 1e-6);
});

test('empty, zero and negative input return zeros rather than NaN', () => {
    for (const bad of [0, -5, Number.NaN, Infinity]) {
        const v = valueScrapGold(4000, bad, 'gram', '14K', JEWELLER);
        assert.equal(v.melt, 0, `weight ${bad} must not produce a value`);
        assert.equal(v.payoutLow, 0);
        assert.ok(!Number.isNaN(v.melt));
    }
});

test('a missing or zero spot price yields zeros, not a bogus valuation', () => {
    // The site can serve a stale snapshot with no usable price; the calculator
    // must not turn that into a confident-looking number.
    for (const bad of [0, -1, Number.NaN]) {
        assert.equal(valueScrapGold(bad, 10, 'gram', '14K', JEWELLER).melt, 0);
    }
});
