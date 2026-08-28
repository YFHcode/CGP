import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors isListedArchiveDay in src/app/sitemap.ts.
 *
 * This rule decides which URLs the site advertises to search engines, so it is
 * worth testing on its own rather than only observing it by diffing a
 * generated sitemap. The failure it guards against is silent in both
 * directions: too permissive publishes twelve thousand near-identical pages,
 * too strict quietly drops pages that were already indexed.
 */

const FROM = '2024-08-01';
const YEARS = new Set(['2005', '2008', '2011', '2012', '2016', '2019', '2020']);

function isListedArchiveDay(periodKey, from = FROM, years = YEARS) {
    if (typeof periodKey !== 'string' || periodKey.length < 4) return false;
    return periodKey >= from || years.has(periodKey.slice(0, 4));
}

test('the recent era is listed in full', () => {
    for (const date of ['2024-08-01', '2024-12-31', '2025-06-15', '2026-08-28']) {
        assert.equal(isListedArchiveDay(date), true, `${date} should be listed`);
    }
});

test('the day before the recent era begins is not listed by date alone', () => {
    // 2024 is not in the demand-year list, so this must fall through to the
    // date rule and be excluded — a boundary worth pinning, since an
    // off-by-one here silently publishes or drops a year of pages.
    assert.equal(isListedArchiveDay('2024-07-31'), false);
});

test('each demand year is listed for the whole year', () => {
    for (const year of YEARS) {
        assert.equal(isListedArchiveDay(`${year}-01-01`), true, `${year} January`);
        assert.equal(isListedArchiveDay(`${year}-12-31`), true, `${year} December`);
    }
});

test('years without measured demand are not listed', () => {
    // Chosen from the gaps between the demand years, so this fails if the set
    // is ever widened without the test being updated deliberately.
    for (const year of ['2001', '2006', '2009', '2013', '2017', '2021', '2023']) {
        assert.equal(isListedArchiveDay(`${year}-06-15`), false, `${year} should not be listed`);
    }
});

test('the two bands are independent', () => {
    // A demand year stays listed even if the recent-era floor moves, and the
    // recent era stays listed even with an empty year set.
    assert.equal(isListedArchiveDay('2011-03-04', '2030-01-01', YEARS), true);
    assert.equal(isListedArchiveDay('2026-03-04', FROM, new Set()), true);
    assert.equal(isListedArchiveDay('2011-03-04', '2030-01-01', new Set()), false);
});

test('malformed keys are excluded rather than throwing', () => {
    for (const bad of ['', 'abc', null, undefined, 42, {}]) {
        assert.equal(isListedArchiveDay(bad), false, `unexpected result for ${String(bad)}`);
    }
});

test('the listed set is a small fraction of a full daily archive', () => {
    // The point of the rule. A 26-year daily series is ~6,500 sessions per
    // metal; this must publish a bounded slice of that, not most of it.
    const dates = [];
    for (let y = 2000; y <= 2026; y++) {
        for (let d = 1; d <= 250; d++) {
            const date = new Date(Date.UTC(y, 0, 1));
            date.setUTCDate(date.getUTCDate() + d);
            dates.push(date.toISOString().slice(0, 10));
        }
    }
    const listed = dates.filter((d) => isListedArchiveDay(d)).length;
    const share = listed / dates.length;
    assert.ok(
        share < 0.35,
        `listing ${(share * 100).toFixed(0)}% of a full daily archive is too much`
    );
    assert.ok(share > 0.1, `listing only ${(share * 100).toFixed(0)}% suggests the rule is broken`);
});
