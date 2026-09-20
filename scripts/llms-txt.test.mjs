import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLlmsTxt, siteUrlsIn } from '../src/lib/llms-txt.ts';

/**
 * llms.txt is read by machines that follow URLs, so every address it prints is
 * a promise. It used to break that promise in five places — /gold-price/YYYY,
 * /silver-price/..., and three /{a,b,c} patterns — which read fine to a person
 * and are indistinguishable from real URLs to a crawler. Google fetched them
 * and reported the 404s in Search Console.
 *
 * These tests exist so that failure mode fails here instead.
 *
 * The archive URLs are passed in rather than derived, because slugForKey lives
 * behind the `@/` alias that node cannot resolve; its correctness is covered
 * by history-periods.test.mjs and cross-checked against 19,551 live slugs in
 * indexnow.test.mjs. What is tested here is the template's own behaviour,
 * which is what regressed.
 */

const SITE = 'https://www.chartgoldprice.com';

const ARCHIVE = {
    goldArchive: {
        year: `${SITE}/gold-price/2026`,
        month: `${SITE}/gold-price/september-2026`,
        day: `${SITE}/gold-price/18-september-2026`,
    },
    silverArchive: {
        year: `${SITE}/silver-price/2026`,
        month: `${SITE}/silver-price/september-2026`,
        day: `${SITE}/silver-price/18-september-2026`,
    },
};

const INPUT = {
    siteUrl: SITE,
    goldPrice: 4416.9,
    silverPrice: 56.85,
    perGram: (oz) => (oz / 31.1034768).toFixed(2),
    updatedAt: '2026-09-18T20:19:02.762Z',
    firstDate: '2000-08-30',
    coverage: '26 years of daily closes',
    source: 'Yahoo Finance (COMEX futures)',
    points: 6517,
    ...ARCHIVE,
};

test('no advertised URL contains a placeholder', () => {
    const urls = siteUrlsIn(buildLlmsTxt(INPUT), SITE);
    assert.ok(urls.length > 20, `expected the key-pages list, got ${urls.length} URLs`);

    for (const url of urls) {
        // Each pattern here is a real shape that shipped: a brace set, an
        // ellipsis, a date stand-in, an unresolved template.
        assert.doesNotMatch(url, /[{}]/, `${url} contains a brace placeholder`);
        assert.doesNotMatch(url, /\.\./, `${url} contains an ellipsis`);
        assert.doesNotMatch(url, /YYYY|\bMM\b|\bDD\b/, `${url} contains a date stand-in`);
        assert.doesNotMatch(url, /\$|<|>/, `${url} contains an unresolved template`);
        assert.doesNotMatch(url, /undefined|null|NaN/, `${url} contains a broken value`);
    }
});

test('every advertised URL is on this site and absolute', () => {
    // The old text also emitted bare "/august-2026" in prose, which resolves
    // against the root and 404s there.
    const body = buildLlmsTxt(INPUT);
    for (const line of body.split('\n')) {
        if (!line.startsWith('- ')) continue;
        const paths = line.match(/(?<![\w/])\/[a-z0-9][\w/-]*/gi) ?? [];
        for (const path of paths) {
            assert.fail(`bare path advertised outside an absolute URL: ${path} in "${line}"`);
        }
    }
});

test('the dated archive examples are printed for both metals', () => {
    const body = buildLlmsTxt(INPUT);

    assert.ok(body.includes(`${SITE}/gold-price/2026`));
    assert.ok(body.includes(`${SITE}/gold-price/september-2026`));
    assert.ok(body.includes(`${SITE}/gold-price/18-september-2026`));
    assert.ok(body.includes(`${SITE}/silver-price/2026`));
});

test('an empty history degrades to a page that exists', () => {
    const body = buildLlmsTxt({ ...INPUT, goldArchive: null, silverArchive: null });
    const urls = siteUrlsIn(body, SITE);

    assert.ok(urls.some((u) => u.endsWith('/gold-price-history')));
    for (const url of urls) {
        assert.doesNotMatch(url, /\/(gold|silver)-price\/(null|undefined)/);
    }
});

test('no currency is advertised that has no page', () => {
    // /gold-price-in/usd has never existed — the site is priced in USD
    // natively — yet the old text listed usd first in {usd,eur,gbp,inr,...}.
    const urls = siteUrlsIn(buildLlmsTxt(INPUT), SITE);

    assert.ok(!urls.includes(`${SITE}/gold-price-in/usd`));
    assert.ok(urls.includes(`${SITE}/gold-price-in/eur`));
});

test('siteUrlsIn would catch a placeholder if one came back', () => {
    // Negative control: the guard is only worth having if it fails on exactly
    // the text that shipped.
    const bad = `See ${SITE}/gold-price-in/{usd,eur} and ${SITE}/silver-price/...`;
    const urls = siteUrlsIn(bad, SITE);

    assert.equal(urls.length, 2);
    assert.ok(urls.some((u) => /[{}]/.test(u)));
    assert.ok(urls.some((u) => u.includes('..')));
});

test('siteUrlsIn strips trailing sentence punctuation', () => {
    assert.deepEqual(siteUrlsIn(`Terms: ${SITE}/terms.`, SITE), [`${SITE}/terms`]);
    assert.deepEqual(siteUrlsIn(`(${SITE})`, SITE), [SITE]);
});

test('the prices and coverage still render', () => {
    const body = buildLlmsTxt(INPUT);

    assert.match(body, /Gold \(XAU\): \$4416\.90 per troy ounce \| \$142\.01 per gram/);
    assert.match(body, /Gold\/silver ratio: 77\.7/);
    assert.match(body, /26 years of daily closes \(USD per troy ounce, 6517 points\)/);
});

test('a missing price says so instead of printing a broken figure', () => {
    const body = buildLlmsTxt({ ...INPUT, goldPrice: null });

    assert.match(body, /- Gold: unavailable/);
    assert.doesNotMatch(body, /\$null|\$NaN|\$undefined/);
});
