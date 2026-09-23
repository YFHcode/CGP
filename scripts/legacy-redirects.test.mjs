import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import nextConfig, { legacyPeriodRedirects } from '../next.config.ts';

/**
 * The legacy ISO archive URLs must land on the canonical readable slug in one
 * permanent hop. Two sources of external truth keep this honest:
 *
 * - Matching runs through Next's own route matcher (getPathMatch, the same code
 *   that evaluates `redirects()`), not a regex re-implementation, so a pattern
 *   Next would read differently fails here.
 * - The expected slug comes from the platform's date formatting, not from the
 *   month list the rules are generated from, so a typo in that list fails too.
 */

const require = createRequire(import.meta.url);
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');

const rules = legacyPeriodRedirects();
const matchers = rules.map((rule) => ({ rule, match: getPathMatch(rule.source) }));

/** Where Next would send a path: the first matching rule, params substituted. */
function redirectFor(path) {
    for (const { rule, match } of matchers) {
        const params = match(path);
        if (params) {
            return {
                status: rule.permanent ? 308 : 307,
                to: rule.destination.replace(/:(\w+)/g, (_, name) => params[name]),
            };
        }
    }
    return null;
}

/** "6-may-2010" from a date, computed independently of the rules' month list. */
function canonicalDay(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day))
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
        .toLowerCase()
        .replace(/ /g, '-');
}

const pad = (n) => String(n).padStart(2, '0');

test('the rules are the ones next.config actually serves', async () => {
    assert.deepEqual(await nextConfig.redirects(), rules);
    assert.ok(rules.every((r) => r.permanent === true), 'every legacy redirect must be permanent');
});

test('every day of a leap year redirects to its readable slug, for both metals', () => {
    let checked = 0;
    for (const base of ['/gold-price', '/silver-price']) {
        for (let month = 1; month <= 12; month++) {
            const days = new Date(Date.UTC(2024, month, 0)).getUTCDate();
            for (let day = 1; day <= days; day++) {
                const result = redirectFor(`${base}/2024-${pad(month)}-${pad(day)}`);
                assert.deepEqual(result, { status: 308, to: `${base}/${canonicalDay(2024, month, day)}` });
                checked++;
            }
        }
    }
    assert.equal(checked, 732);
});

test('ISO months redirect to the readable month slug', () => {
    for (let month = 1; month <= 12; month++) {
        const name = new Date(Date.UTC(2010, month - 1, 1))
            .toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
            .toLowerCase();
        assert.deepEqual(redirectFor(`/gold-price/2010-${pad(month)}`), { status: 308, to: `/gold-price/${name}-2010` });
    }
});

test('a zero-padded readable day loses its zero', () => {
    assert.deepEqual(redirectFor('/gold-price/06-may-2010'), { status: 308, to: '/gold-price/6-may-2010' });
    assert.deepEqual(redirectFor('/silver-price/09-november-2007'), { status: 308, to: '/silver-price/9-november-2007' });
});

test('canonical URLs and other routes are never redirected', () => {
    // A rule that caught these would loop, or move pages that are already right.
    for (const path of [
        '/gold-price/6-may-2010', '/gold-price/may-2010', '/gold-price/2010', '/gold-price/16-may-2023',
        '/gold-price', '/gold-price-today', '/gold-price-in/eur', '/charts/gold',
        '/gold-price/2010-5-6',     // not the legacy shape
        '/gold-price/2010-13',      // no 13th month
        '/gold-price/2010-05-32',   // no 32nd day
        '/gold-price/2010-05-00',
    ]) {
        assert.equal(redirectFor(path), null, `${path} should not redirect`);
    }
});

test('negative control: a month list with a typo would be caught', () => {
    const broken = legacyPeriodRedirects().map((r) => ({ ...r, destination: r.destination.replace('-may-', '-mai-') }));
    const match = broken.map((rule) => ({ rule, m: getPathMatch(rule.source) }));
    const hit = match.find(({ m }) => m('/gold-price/2010-05-06'));
    const to = hit.rule.destination.replace(/:(\w+)/g, (_, n) => hit.m('/gold-price/2010-05-06')[n]);
    assert.notEqual(to, `/gold-price/${canonicalDay(2010, 5, 6)}`);
});
