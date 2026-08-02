import test from 'node:test';
import assert from 'node:assert/strict';

import { extractPrice, assessPrice, formatRow } from './probe-sources.mjs';

test('extractPrice finds a top-level price field', () => {
    assert.deepEqual(extractPrice({ price: 2345.6, metal: 'XAU' }), {
        value: 2345.6,
        path: 'price',
    });
});

test('extractPrice finds nested rates by metal symbol', () => {
    // Metals-API / Commodities-API shape.
    const found = extractPrice({ success: true, base: 'USD', rates: { XAU: 2650.45 } });
    assert.equal(found.value, 2650.45);
    assert.equal(found.path, 'rates.XAU');
});

test('extractPrice prefers the shallowest match', () => {
    const found = extractPrice({
        price: 2000,
        meta: { nested: { price: 999 } },
    });
    assert.equal(found.value, 2000);
    assert.equal(found.path, 'price');
});

test('extractPrice walks arrays', () => {
    const found = extractPrice({ items: [{ spot: 2100 }] });
    assert.equal(found.value, 2100);
});

test('extractPrice ignores zero, negative and non-numeric values', () => {
    assert.equal(extractPrice({ price: 0 }), null);
    assert.equal(extractPrice({ price: -5 }), null);
    assert.equal(extractPrice({ price: 'n/a' }), null);
});

test('extractPrice returns null when nothing looks like a price', () => {
    assert.equal(extractPrice({ error: 'quota exceeded', code: 429 }), null);
    assert.equal(extractPrice({}), null);
    assert.equal(extractPrice(null), null);
});

test('assessPrice accepts plausible gold and silver quotes', () => {
    assert.equal(assessPrice(2650, 'XAU').ok, true);
    assert.equal(assessPrice(31.5, 'XAG').ok, true);
});

test('assessPrice detects inverted XAU/USD quotes', () => {
    // Some APIs return metal-per-USD (1/2650 = 0.000377).
    const verdict = assessPrice(0.000377, 'XAU');
    assert.equal(verdict.ok, false);
    assert.match(verdict.note, /INVERTED/);
});

test('assessPrice detects per-gram values sold as per-ounce', () => {
    // 2650/oz is ~85.2/gram.
    const verdict = assessPrice(85.2, 'XAU');
    assert.equal(verdict.ok, false);
    assert.match(verdict.note, /PER-GRAM/);
});

test('assessPrice rejects wildly implausible values', () => {
    const verdict = assessPrice(50_000_000, 'XAU');
    assert.equal(verdict.ok, false);
    assert.match(verdict.note, /implausible/);
});

test('assessPrice guards junk input', () => {
    assert.equal(assessPrice(Number.NaN, 'XAU').ok, false);
    assert.equal(assessPrice(0, 'XAU').ok, false);
    assert.equal(assessPrice(2650, 'XPT').ok, false);
});

test('formatRow renders a markdown row and escapes pipes', () => {
    const row = formatRow({
        ok: true, name: 'Test API', kind: 'spot', httpStatus: 200, ms: 120,
        price: 2650.4567, note: 'price — plausible gold USD/oz',
    });
    assert.match(row, /^\| ✅ \| Test API \| spot \| 200 \| 120 \| 2650\.46 \|/);

    const escaped = formatRow({ ok: false, name: 'X', kind: 'spot', note: 'a|b' });
    assert.ok(escaped.includes('a\\|b'), 'pipes must be escaped so the table survives');
});

test('formatRow marks skipped probes distinctly', () => {
    const row = formatRow({ ok: false, status: 'skipped', name: 'Keyed API', kind: 'spot', note: 'no key' });
    assert.match(row, /⏭️/);
});
