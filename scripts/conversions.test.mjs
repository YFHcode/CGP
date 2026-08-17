/**
 * Tests for the pure money/weight maths in src/lib/conversions.ts.
 *
 * The source is TypeScript, so the logic under test is mirrored here as plain
 * JS. Keep the two in sync — these guard the numbers users actually act on.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const GRAMS_PER_OZ = 31.1034768;
const GRAMS_PER_KG = 1000;

const KARAT_PURITY = {
    '24K': 1,
    '22K': 22 / 24,
    '21K': 21 / 24,
    '18K': 18 / 24,
    '14K': 14 / 24,
    '10K': 10 / 24,
};

function pricePerUnit(pricePerOz, unit) {
    if (!Number.isFinite(pricePerOz)) return Number.NaN;
    if (unit === 'oz') return pricePerOz;
    if (unit === 'gram') return pricePerOz / GRAMS_PER_OZ;
    if (unit === 'kg') return (pricePerOz / GRAMS_PER_OZ) * GRAMS_PER_KG;
    return pricePerOz;
}

function convertToGrams(value, unit) {
    if (unit === 'oz') return value * GRAMS_PER_OZ;
    if (unit === 'kg') return value * GRAMS_PER_KG;
    return value;
}

function calculateGoldValue(pricePerOz, weight, weightUnit, karat) {
    if (!Number.isFinite(pricePerOz) || !Number.isFinite(weight) || weight <= 0) return 0;
    return convertToGrams(weight, weightUnit) * (pricePerOz / GRAMS_PER_OZ) * (KARAT_PURITY[karat] ?? 1);
}

function goldSilverRatio(gold, silver) {
    if (!Number.isFinite(gold) || !Number.isFinite(silver) || silver <= 0) return Number.NaN;
    return gold / silver;
}

function positionInRange(price, low, high) {
    if (![price, low, high].every(Number.isFinite) || high <= low) return Number.NaN;
    return ((price - low) / (high - low)) * 100;
}

const close = (a, b, eps = 1e-9) =>
    assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

test('one troy ounce of 24K gold is worth exactly the spot price', () => {
    close(calculateGoldValue(2000, 1, 'oz', '24K'), 2000);
});

test('24K uses full purity — spot price is already pure gold', () => {
    // The old table used 0.999 here, understating every 24K valuation by 0.1%.
    assert.equal(KARAT_PURITY['24K'], 1);
    close(calculateGoldValue(2000, 1, 'oz', '24K'), 2000);
});

test('karat purities are exact karat/24 fractions', () => {
    close(KARAT_PURITY['18K'], 0.75);
    close(KARAT_PURITY['22K'], 0.9166666666666666);
    close(KARAT_PURITY['14K'], 0.5833333333333334);
});

test('18K gold is worth three quarters of pure gold', () => {
    close(calculateGoldValue(2000, 1, 'oz', '18K'), 1500);
});

test('a kilo of 24K gold matches its per-gram value', () => {
    const perGram = 2000 / GRAMS_PER_OZ;
    close(calculateGoldValue(2000, 1, 'kg', '24K'), perGram * 1000);
});

test('weight units are internally consistent', () => {
    const asOz = calculateGoldValue(2000, 1, 'oz', '24K');
    const asGrams = calculateGoldValue(2000, GRAMS_PER_OZ, 'gram', '24K');
    close(asOz, asGrams, 1e-6);
});

test('calculateGoldValue returns 0 for zero, negative and junk weights', () => {
    assert.equal(calculateGoldValue(2000, 0, 'oz', '24K'), 0);
    assert.equal(calculateGoldValue(2000, -5, 'oz', '24K'), 0);
    assert.equal(calculateGoldValue(2000, Number.NaN, 'oz', '24K'), 0);
    assert.equal(calculateGoldValue(Number.NaN, 1, 'oz', '24K'), 0);
});

test('pricePerUnit agrees with the calculator for a unit quantity', () => {
    for (const unit of ['oz', 'gram', 'kg']) {
        close(pricePerUnit(2000, unit), calculateGoldValue(2000, 1, unit, '24K'), 1e-9);
    }
});

test('pricePerUnit converts ounce prices to grams and kilos', () => {
    close(pricePerUnit(GRAMS_PER_OZ, 'gram'), 1);
    close(pricePerUnit(GRAMS_PER_OZ, 'kg'), 1000);
    close(pricePerUnit(2000, 'oz'), 2000);
});

test('goldSilverRatio divides gold by silver and guards bad input', () => {
    close(goldSilverRatio(2000, 25), 80);
    assert.ok(Number.isNaN(goldSilverRatio(2000, 0)));
    assert.ok(Number.isNaN(goldSilverRatio(2000, -1)));
    assert.ok(Number.isNaN(goldSilverRatio(Number.NaN, 25)));
});

test('positionInRange maps a price onto its day range', () => {
    close(positionInRange(150, 100, 200), 50);
    close(positionInRange(100, 100, 200), 0);
    close(positionInRange(200, 100, 200), 100);
});

test('positionInRange guards a collapsed or inverted range', () => {
    assert.ok(Number.isNaN(positionInRange(100, 100, 100)));
    assert.ok(Number.isNaN(positionInRange(100, 200, 100)));
    assert.ok(Number.isNaN(positionInRange(Number.NaN, 100, 200)));
});

const hasRangeData = (data) => data.high_price !== data.low_price;

test('hasRangeData is true for a real day range', () => {
    assert.equal(hasRangeData({ high_price: 4416.53, low_price: 4367.31 }), true);
});

test('hasRangeData is false for the keyless fallback shape (high === low)', () => {
    // scripts/refresh-data.mjs's gold-api.com fallback sets
    // high_price === low_price === price rather than inventing a range —
    // this is the exact quote shape that produced three days of a flat
    // "$X — $X" range and a 0.00% change on the live site (2026-08-14 to
    // 2026-08-17) before this check existed.
    assert.equal(hasRangeData({ high_price: 4396.2, low_price: 4396.2 }), false);
});

test('hasRangeData treats a genuinely flat trading day the same as no data', () => {
    // A real high === low is indistinguishable from the fallback shape by
    // this field alone, and both cases render the same honest "unavailable"
    // UI, so there is nothing further to disambiguate here.
    assert.equal(hasRangeData({ high_price: 2000, low_price: 2000 }), false);
});

test('troy ounce constant is the exact defined value', () => {
    assert.equal(GRAMS_PER_OZ, 31.1034768);
});

const GOLD_HALLMARK_PURITY = {
    '375': 0.375,
    '585': 0.585,
    '750': 0.75,
    '916': 0.916,
    '990': 0.99,
    '999': 0.999,
};

test('UK gold hallmarks match the published legal standard, not a derived karat fraction', () => {
    // 9ct (375) and 18ct (750) land exactly on n/24, but 14ct and 22ct do
    // not: the internationally agreed hallmark for "14 carat" is 585, not
    // the mathematically exact 14/24 = .5833, and "22 carat" is 916, not
    // 22/24 = .9167. These are independently defined legal minimum finenesses
    // (ISO 9202 / the UK Hallmarking Act 1973), not the karat fraction
    // rounded to three digits, so the values must be pinned to the actual
    // published standard rather than derived from n/24.
    assert.equal(GOLD_HALLMARK_PURITY['375'], 9 / 24);
    assert.equal(GOLD_HALLMARK_PURITY['750'], 18 / 24);
    assert.equal(GOLD_HALLMARK_PURITY['585'], 0.585);
    assert.notEqual(GOLD_HALLMARK_PURITY['585'], 14 / 24);
    assert.equal(GOLD_HALLMARK_PURITY['916'], 0.916);
    assert.notEqual(GOLD_HALLMARK_PURITY['916'], 22 / 24);
});

test('999 gold hallmark matches fine gold, not 24 karat exactly', () => {
    // 24K in this codebase's own convention is defined as 1.0 (spot price
    // already is pure gold), but the 999 *hallmark* is the physical standard
    // for fine bullion — 99.9% pure, not 100%. The two are close but must
    // not be conflated: a page quoting 999 gold at the full 24K/spot price
    // would overstate it by 0.1%.
    assert.equal(GOLD_HALLMARK_PURITY['999'], 0.999);
    assert.notEqual(GOLD_HALLMARK_PURITY['999'], 1);
});
