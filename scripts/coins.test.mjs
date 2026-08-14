/**
 * Tests for the coin melt-value maths in src/lib/coins.ts.
 *
 * The source is TypeScript, so the logic under test is mirrored here as plain
 * JS, matching the convention in conversions.test.mjs. Keep the two in sync.
 *
 * These assert against published mint specifications rather than against
 * whatever the code currently returns — a coin's silver content is an
 * external fact, so a test that just echoes the implementation would catch
 * nothing. The ASW/AGW figures below are the ones the trade quotes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const GRAMS_PER_OZ = 31.1034768;

const pureGrams = (coin) => coin.grossGrams * coin.fineness;
const pureTroyOz = (coin) => pureGrams(coin) / GRAMS_PER_OZ;
const meltValue = (coin, spotPerOz) =>
    Number.isFinite(spotPerOz) ? pureTroyOz(coin) * spotPerOz : Number.NaN;

const DIME = { grossGrams: 2.5, fineness: 0.9 };
const QUARTER = { grossGrams: 6.25, fineness: 0.9 };
const HALF = { grossGrams: 12.5, fineness: 0.9 };
const HALF_40 = { grossGrams: 11.5, fineness: 0.4 };
const MORGAN = { grossGrams: 26.73, fineness: 0.9 };
const WAR_NICKEL = { grossGrams: 5, fineness: 0.35 };
const GOLD_EAGLE = { grossGrams: 33.931, fineness: 0.9167 };
const KRUGERRAND = { grossGrams: 33.93, fineness: 0.9167 };
const SOVEREIGN = { grossGrams: 7.98805, fineness: 0.9167 };

/**
 * Tolerance for published ASW/AGW figures.
 *
 * The trade quotes these rounded to five decimals, so they sit a hair off the
 * exact arithmetic — a Morgan is exactly 0.7734505 ozt but is universally
 * listed as 0.77344. 2e-5 accommodates that rounding while still failing hard
 * on any real specification error, which would be wrong by whole percent.
 */
const ASW_TOLERANCE = 0.00002;

test('US 90% silver coins match their published ASW', () => {
    // The figures the trade quotes, in troy ounces of actual silver weight.
    assert.ok(Math.abs(pureTroyOz(DIME) - 0.07234) < ASW_TOLERANCE);
    assert.ok(Math.abs(pureTroyOz(QUARTER) - 0.18084) < ASW_TOLERANCE);
    assert.ok(Math.abs(pureTroyOz(HALF) - 0.36169) < ASW_TOLERANCE);
    assert.ok(Math.abs(pureTroyOz(MORGAN) - 0.77344) < ASW_TOLERANCE);
});

test('40% Kennedy and war nickel match their published ASW', () => {
    assert.ok(Math.abs(pureTroyOz(HALF_40) - 0.14789) < ASW_TOLERANCE);
    assert.ok(Math.abs(pureTroyOz(WAR_NICKEL) - 0.05626) < ASW_TOLERANCE);
});

test('a dollar of face value is 22.5 g of silver in every 90% denomination', () => {
    // Ten dimes, four quarters and two halves are the same silver by design.
    assert.ok(Math.abs(pureGrams(DIME) * 10 - 22.5) < 1e-9);
    assert.ok(Math.abs(pureGrams(QUARTER) * 4 - 22.5) < 1e-9);
    assert.ok(Math.abs(pureGrams(HALF) * 2 - 22.5) < 1e-9);
});

test('one-ounce gold coins all contain exactly one troy ounce of gold', () => {
    // The Gold Eagle and Krugerrand weigh more than an ounce because the 22K
    // alloy is added on top of a full ounce of gold, not mixed into it.
    assert.ok(Math.abs(pureTroyOz(GOLD_EAGLE) - 1) < 0.0005);
    assert.ok(Math.abs(pureTroyOz(KRUGERRAND) - 1) < 0.0005);
});

test('the gold sovereign matches its published AGW', () => {
    assert.ok(Math.abs(pureGrams(SOVEREIGN) - 7.3224) < 0.0005);
    assert.ok(Math.abs(pureTroyOz(SOVEREIGN) - 0.2354) < 0.0001);
});

test('meltValue scales linearly with spot', () => {
    const atFifty = meltValue(QUARTER, 50);
    const atHundred = meltValue(QUARTER, 100);
    assert.ok(Math.abs(atHundred - atFifty * 2) < 1e-9);
    assert.ok(Math.abs(atFifty - 0.18084 * 50) < 0.001);
});

test('meltValue returns NaN rather than a bogus number for a missing spot price', () => {
    assert.ok(Number.isNaN(meltValue(QUARTER, Number.NaN)));
    assert.ok(Number.isNaN(meltValue(QUARTER, Infinity)));
});

const formatFineness = (fineness) => {
    const trimmed = fineness.toFixed(4).replace(/0+$/, '');
    const [, decimals = ''] = trimmed.split('.');
    return fineness.toFixed(Math.max(3, decimals.length)).replace(/^0/, '');
};

test('formatFineness writes purity the way the trade stamps it', () => {
    // A naive toString gives "0.9" for 90% silver, which is arithmetically
    // right but not notation anyone buying metal would recognise.
    assert.equal(formatFineness(0.9), '.900');
    assert.equal(formatFineness(0.4), '.400');
    assert.equal(formatFineness(0.35), '.350');
    assert.equal(formatFineness(0.999), '.999');
});

test('formatFineness keeps the fourth digit where it carries real information', () => {
    assert.equal(formatFineness(0.9167), '.9167');
    assert.equal(formatFineness(0.9999), '.9999');
});

const formatPurityPercent = (fineness) =>
    `${(fineness * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

test('formatPurityPercent is exact and drops trailing zeros', () => {
    // No single fixed decimal count works: one decimal turns 22 karat's
    // 91.67% into a wrong-looking 91.7%, two pads 90% into "90.00%".
    assert.equal(formatPurityPercent(0.9), '90%');
    assert.equal(formatPurityPercent(0.4), '40%');
    assert.equal(formatPurityPercent(0.35), '35%');
    assert.equal(formatPurityPercent(0.999), '99.9%');
    assert.equal(formatPurityPercent(0.9999), '99.99%');
    assert.equal(formatPurityPercent(0.9167), '91.67%');
});
