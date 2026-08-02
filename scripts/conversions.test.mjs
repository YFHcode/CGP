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

test('troy ounce constant is the exact defined value', () => {
    assert.equal(GRAMS_PER_OZ, 31.1034768);
});
