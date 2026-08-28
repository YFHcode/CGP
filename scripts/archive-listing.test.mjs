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

function isListedArchiveDay(periodKey, notable = new Set(), from = FROM, years = YEARS) {
    if (typeof periodKey !== 'string' || periodKey.length < 4) return false;
    if (periodKey >= from) return true;
    if (years.has(periodKey.slice(0, 4))) return true;
    return notable.has(periodKey);
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

test('the three bands are independent', () => {
    // A demand year stays listed even if the recent-era floor moves, the
    // recent era stays listed even with an empty year set, and a notable day
    // stays listed with both of the other bands closed.
    const none = new Set();
    assert.equal(isListedArchiveDay('2011-03-04', none, '2030-01-01', YEARS), true);
    assert.equal(isListedArchiveDay('2026-03-04', none, FROM, new Set()), true);
    assert.equal(isListedArchiveDay('2011-03-04', none, '2030-01-01', new Set()), false);
    assert.equal(
        isListedArchiveDay('2011-03-04', new Set(['2011-03-04']), '2030-01-01', new Set()),
        true
    );
});

test('a notable day is listed even in a year with no measured demand', () => {
    // The reason this band exists: the milestone timeline on the insights
    // pages links every notable day, so excluding them left pages linked from
    // an indexed page but absent from the sitemap.
    const notable = new Set(['2006-05-11', '2013-04-15', '2020-03-16']);
    for (const date of notable) {
        assert.equal(isListedArchiveDay(date, notable), true, `${date} should be listed`);
    }
    // Its neighbours in the same excluded year are not dragged in with it.
    assert.equal(isListedArchiveDay('2006-05-12', notable), false);
    assert.equal(isListedArchiveDay('2013-04-16', notable), false);
});

test('an empty notable set reproduces the original two-band rule', () => {
    // Guards the default: callers that pass no set must not accidentally widen
    // the listing.
    for (const date of ['2001-06-15', '2006-06-15', '2013-06-15', '2024-07-31']) {
        assert.equal(isListedArchiveDay(date), false, `${date} should not be listed`);
    }
});

test('malformed keys are excluded rather than throwing', () => {
    for (const bad of ['', 'abc', null, undefined, 42, {}]) {
        assert.equal(isListedArchiveDay(bad), false, `unexpected result for ${String(bad)}`);
    }
});

/** ~26 years of trading sessions, the shape the real rule runs against. */
function syntheticArchive() {
    const dates = [];
    for (let y = 2000; y <= 2026; y++) {
        for (let d = 1; d <= 250; d++) {
            const date = new Date(Date.UTC(y, 0, 1));
            date.setUTCDate(date.getUTCDate() + d);
            dates.push(date.toISOString().slice(0, 10));
        }
    }
    return dates;
}

test('the configured bands alone publish a small fraction of a full archive', () => {
    // The point of the rule. A 26-year daily series is ~6,500 sessions per
    // metal; this must publish a bounded slice of that, not most of it.
    const dates = syntheticArchive();
    const listed = dates.filter((d) => isListedArchiveDay(d)).length;
    const share = listed / dates.length;
    assert.ok(
        share < 0.35,
        `listing ${(share * 100).toFixed(0)}% of a full daily archive is too much`
    );
    assert.ok(share > 0.1, `listing only ${(share * 100).toFixed(0)}% suggests the rule is broken`);
});

test('adding the notable band widens the listing without unbounding it', () => {
    // Measured against the real data at the time this was written: the
    // milestone timelines link 2,470 day pages across both metals, roughly a
    // fifth of the ~12,900 that exist. Modelled at that density here, so the
    // bound reflects what actually ships rather than an invented ratio.
    const dates = syntheticArchive();
    const notable = new Set(dates.filter((_, i) => i % 5 === 0));

    const twoBand = dates.filter((d) => isListedArchiveDay(d)).length;
    const threeBand = dates.filter((d) => isListedArchiveDay(d, notable)).length;

    assert.ok(threeBand > twoBand, 'the notable band must actually add pages');
    const share = threeBand / dates.length;
    assert.ok(
        share < 0.55,
        `listing ${(share * 100).toFixed(0)}% with the notable band is more than intended`
    );
});
