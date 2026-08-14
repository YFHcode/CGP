import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    extractGtmId,
    extractMeasurementIds,
    extractInlineMeasurementIds,
    extractTrackingIds,
    extractTagTypes,
    describeError,
} from './verify-tracking.mjs';

test('extractGtmId finds the container ID when the loader builds the URL by concatenation', () => {
    // This is the actual shape Google's standard snippet produces: the ID is
    // a literal string argument, but the gtm.js URL itself is assembled at
    // runtime ('...gtm.js?id='+i+dl) and never appears whole in the HTML.
    const html = [
        '<script>(function(w,d,s,l,i){',
        "j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;",
        "})(window,document,'script','dataLayer','GTM-5HH5Z24L');</script>",
    ].join('\n');
    assert.equal(extractGtmId(html), 'GTM-5HH5Z24L');
});

test('extractGtmId finds the container ID in the noscript iframe fallback', () => {
    const html = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5HH5Z24L"></iframe></noscript>`;
    assert.equal(extractGtmId(html), 'GTM-5HH5Z24L');
});

test('extractGtmId returns null when no GTM snippet is present', () => {
    assert.equal(extractGtmId('<html><body>no analytics here</body></html>'), null);
});

test('extractMeasurementIds finds GA4 IDs compiled into a container and dedupes them', () => {
    const gtmJs = `some,minified,code,"G-630K6DQSNK",more.code,'G-630K6DQSNK',other,"G-ABCDEF1234"`;
    assert.deepEqual(extractMeasurementIds(gtmJs), ['G-630K6DQSNK', 'G-ABCDEF1234']);
});

test('extractMeasurementIds returns an empty array when no GA4 tag is compiled in', () => {
    assert.deepEqual(extractMeasurementIds('function gtm(){/* no ga4 config tag here */}'), []);
});

test('extractInlineMeasurementIds finds a direct gtag.js reference in page HTML', () => {
    const html = `<script src="https://www.googletagmanager.com/gtag/js?id=G-630K6DQSNK"></script>`;
    assert.deepEqual(extractInlineMeasurementIds(html), ['G-630K6DQSNK']);
});

test('extractTrackingIds finds a GT- Google tag that a G-only check would miss', () => {
    // The false-negative mode this exists to close: a container configured
    // with a Google tag carries no G- measurement ID at all, so reporting
    // "no GA4 ID" as a hard failure would be wrong.
    const gtmJs = `code,"GT-ABC1234",more`;
    assert.deepEqual(extractTrackingIds(gtmJs), { googleTag: ['GT-ABC1234'] });
    assert.deepEqual(extractMeasurementIds(gtmJs), []);
});

test('extractTrackingIds groups every Google product ID by kind', () => {
    const gtmJs = `"G-630K6DQSNK","AW-12345678","UA-1234567-1","DC-9876543"`;
    assert.deepEqual(extractTrackingIds(gtmJs), {
        ga4: ['G-630K6DQSNK'],
        ads: ['AW-12345678'],
        universalAnalytics: ['UA-1234567-1'],
        floodlight: ['DC-9876543'],
    });
});

test('extractTrackingIds returns nothing for a container with no Google tags', () => {
    assert.deepEqual(extractTrackingIds('function(){/* empty container */}'), {});
});

test('extractTagTypes identifies GA4 tag templates by their internal token', () => {
    assert.deepEqual(extractTagTypes('...,"gaawc",...,"gaawe",...'), [
        'GA4 Configuration',
        'GA4 Event',
    ]);
});

test('extractTagTypes finds nothing in a container with no Google tag templates', () => {
    assert.deepEqual(extractTagTypes('var a="html";var b="img";'), []);
});

test('describeError surfaces the nested cause behind a generic "fetch failed"', () => {
    // This is the actual shape Node's fetch throws: a TypeError whose message
    // is just "fetch failed", with the real reason in .cause. This is the bug
    // that made the first live run unreadable — "Site unreachable — fetch
    // failed" with no way to tell DNS failure from a WAF block.
    const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND www.chartgoldprice.com'), {
        code: 'ENOTFOUND',
    });
    const fetchError = Object.assign(new TypeError('fetch failed'), { cause: dnsError });

    const described = describeError(fetchError);
    assert.match(described, /fetch failed/);
    assert.match(described, /ENOTFOUND/);
    assert.match(described, /getaddrinfo/);
});

test('describeError reports a clear timeout message for an AbortError', () => {
    const error = new Error('This operation was aborted');
    error.name = 'AbortError';
    assert.match(describeError(error), /timeout after \d+ms/);
});
