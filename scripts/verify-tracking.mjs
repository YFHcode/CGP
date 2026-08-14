#!/usr/bin/env node
/**
 * Verifies the analytics tag actually reaches GA4, not just that GTM loads.
 *
 * Runs in CI because GitHub runners have unrestricted outbound internet, so
 * this is the only place googletagmanager.com and the live site can genuinely
 * be checked — the same reason scripts/probe-sources.mjs exists. It never
 * writes to data/. Run it from the Actions tab whenever GA4 reports "no data".
 *
 * It cannot see whether the container's *published* GTM version fires the
 * GA4 tag on every trigger (that requires GTM Preview mode in the browser),
 * but a published container that contains no GA4 measurement ID at all is
 * enough on its own to explain a property receiving nothing.
 */
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SITE_URL = process.env.SITE_URL || 'https://www.chartgoldprice.com';
const TIMEOUT_MS = 20000;

/** Identifies this diagnostic honestly when fetching our own site. */
const PROBE_UA = 'ChartGoldPrice-TrackingProbe/1.0';

/**
 * Used only for the googletagmanager.com container fetch. The point of this
 * check is to read the same container a real visitor's browser receives, so
 * a container that varied by user agent would give a misleading answer. This
 * is about measurement accuracy against Google's own CDN, not evading it.
 */
const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in verify-tracking.test.mjs)
// ---------------------------------------------------------------------------

/**
 * Pulls the GTM container ID out of the page HTML.
 *
 * Google's standard async loader builds the gtm.js URL by string
 * concatenation (`'…gtm.js?id='+i+dl`), so `gtm.js?id=GTM-XXXX` never
 * appears as a literal substring in the response — matching on that URL
 * shape produces a false "no snippet found" on a page that has the tag.
 * The ID itself does appear literally, though: as the bootstrap IIFE's
 * last argument and in the `<noscript>` iframe's `src`. Matching the ID
 * pattern directly works regardless of how the surrounding script builds
 * the URL around it.
 */
export function extractGtmId(html) {
    const match = html.match(/GTM-[A-Z0-9]+/);
    return match ? match[0] : null;
}

/** Finds every GA4 measurement ID (G-XXXXXXXXXX) compiled into a published GTM container. */
export function extractMeasurementIds(gtmJs) {
    const matches = gtmJs.match(/G-[A-Z0-9]{6,}/g) ?? [];
    return [...new Set(matches)];
}

/**
 * Finds every Google product tracking ID of any kind in a container.
 *
 * Looking only for `G-` measurement IDs is not enough to conclude a container
 * has no analytics tag: Google's newer "Google tag" uses `GT-` IDs, and a
 * container can also carry Ads (`AW-`), Floodlight (`DC-`) or legacy
 * Universal Analytics (`UA-`) tags. Reporting all of them turns a bare "no
 * GA4 found" into something self-evidencing — an operator can see whether the
 * container is genuinely empty or merely configured a different way.
 */
export function extractTrackingIds(gtmJs) {
    const patterns = {
        ga4: /G-[A-Z0-9]{6,}/g,
        googleTag: /GT-[A-Z0-9]{6,}/g,
        ads: /AW-[0-9]{6,}/g,
        floodlight: /DC-[0-9]{6,}/g,
        universalAnalytics: /UA-[0-9]{4,}-[0-9]{1,4}/g,
    };

    const found = {};
    for (const [kind, pattern] of Object.entries(patterns)) {
        const matches = gtmJs.match(pattern) ?? [];
        if (matches.length > 0) found[kind] = [...new Set(matches)];
    }
    return found;
}

/**
 * Detects which Google tag *templates* a container compiles in, independent
 * of any ID.
 *
 * GTM identifies tag types by short internal tokens, so their presence is a
 * second, ID-independent line of evidence: `gaawc` is a GA4 Configuration
 * tag, `gaawe` a GA4 Event tag, `googtag` the unified Google tag. A container
 * with none of these and no tracking IDs is genuinely missing its analytics
 * tag rather than being configured in a shape this script cannot read.
 */
export function extractTagTypes(gtmJs) {
    const known = {
        gaawc: 'GA4 Configuration',
        gaawe: 'GA4 Event',
        googtag: 'Google tag',
        ua: 'Universal Analytics (legacy)',
        sp: 'Floodlight',
        awct: 'Google Ads Conversion',
    };

    return Object.entries(known)
        .filter(([token]) => new RegExp(`"${token}"`).test(gtmJs))
        .map(([, label]) => label);
}

/** Finds every direct gtag.js measurement ID referenced in the page HTML itself. */
export function extractInlineMeasurementIds(html) {
    const matches = html.match(/G-[A-Z0-9]{6,}/g) ?? [];
    return [...new Set(matches)];
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/**
 * Node's fetch wraps the real network failure (DNS lookup, connection reset,
 * TLS handshake, etc.) behind a generic `TypeError: fetch failed`, with the
 * actual cause nested in `error.cause`. Printing only `error.message` — as
 * the first version of this script did — hides exactly the information
 * needed to tell a transient blip apart from something systematic.
 */
export function describeError(error) {
    if (error?.name === 'AbortError') return `timeout after ${TIMEOUT_MS}ms`;

    const parts = [error?.message ?? String(error)];
    let cause = error?.cause;
    let depth = 0;
    while (cause && depth < 4) {
        const code = cause.code ? ` [${cause.code}]` : '';
        parts.push(`${cause.message ?? String(cause)}${code}`);
        cause = cause.cause;
        depth += 1;
    }
    return parts.join(' — caused by: ');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries once on a network-level failure (DNS, connection reset, TLS,
 * timeout) but never on an HTTP error response — a 403 or 500 is a real
 * diagnostic signal, not flakiness, and retrying would just hide it behind
 * a delay. One retry is enough to tell a genuine outage apart from the kind
 * of one-off blip a runner or a WAF occasionally produces.
 */
async function timedFetch(url, { retries = 1, userAgent = PROBE_UA } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const started = Date.now();
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': userAgent },
            });
            const text = await res.text();
            return { res, text, ms: Date.now() - started };
        } catch (error) {
            lastError = error;
            if (attempt < retries) await sleep(2000 * (attempt + 1));
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError;
}

async function main() {
    const lines = ['## Analytics tracking verification', ''];
    lines.push(`Run at ${new Date().toISOString()} against ${SITE_URL}.`, '');

    let exitCode = 0;

    // 1. Fetch the live page and find which GTM container it actually loads.
    let html;
    try {
        const { res, text, ms } = await timedFetch(SITE_URL);
        if (!res.ok) {
            lines.push(`❌ **Site unreachable** — HTTP ${res.status} after ${ms}ms.`, '');
            await report(lines);
            process.exitCode = 1;
            return;
        }
        html = text;
        lines.push(`✅ Site responded (HTTP ${res.status}, ${ms}ms).`, '');
    } catch (error) {
        lines.push(`❌ **Site unreachable** — ${describeError(error)}.`, '');
        await report(lines);
        process.exitCode = 1;
        return;
    }

    const gtmId = extractGtmId(html);
    const inlineIds = extractInlineMeasurementIds(html);

    if (!gtmId) {
        lines.push(
            '❌ **No Google Tag Manager snippet found in the page HTML.** ' +
                (inlineIds.length > 0
                    ? `A direct gtag.js reference to ${inlineIds.join(', ')} was found instead — GA4 is not routed through GTM on this deploy.`
                    : 'No gtag.js reference was found either — no analytics tag is loading at all.'),
            ''
        );
        await report(lines);
        process.exitCode = 1;
        return;
    }
    lines.push(`✅ Page loads GTM container \`${gtmId}\`.`, '');

    // 2. Fetch the published container and look for a compiled GA4 tag.
    const gtmUrl = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
    let gtmJs;
    try {
        const { res, text, ms } = await timedFetch(gtmUrl, { userAgent: BROWSER_UA });
        if (!res.ok) {
            lines.push(
                `❌ **GTM container is not publicly reachable** — HTTP ${res.status} after ${ms}ms ` +
                    `fetching \`${gtmUrl}\`. If this container was recently created or renamed, ` +
                    'double-check the ID in src/app/layout.tsx (NEXT_PUBLIC_GTM_ID) matches Tag Manager.',
                ''
            );
            await report(lines);
            process.exitCode = 1;
            return;
        }
        gtmJs = text;
        lines.push(`✅ GTM container is publicly reachable (HTTP ${res.status}, ${ms}ms).`, '');
    } catch (error) {
        lines.push(`❌ **Could not fetch the GTM container** — ${describeError(error)}.`, '');
        await report(lines);
        process.exitCode = 1;
        return;
    }

    // Always report what the container *does* contain, so a negative result
    // is self-evidencing rather than an unexplained assertion.
    const measurementIds = extractMeasurementIds(gtmJs);
    const trackingIds = extractTrackingIds(gtmJs);
    const tagTypes = extractTagTypes(gtmJs);

    lines.push(
        `Container size: ${(gtmJs.length / 1024).toFixed(1)} KB. ` +
            `Google tag templates detected: ${tagTypes.length > 0 ? tagTypes.join(', ') : 'none'}. ` +
            `Tracking IDs found: ${
                Object.keys(trackingIds).length > 0
                    ? Object.entries(trackingIds)
                          .map(([kind, ids]) => `${kind}=${ids.join('/')}`)
                          .join(', ')
                    : 'none'
            }.`,
        ''
    );

    if (measurementIds.length > 0) {
        lines.push(
            `✅ Published container references GA4 measurement ID(s): ${measurementIds.join(', ')}.`,
            '',
            '> This confirms the container is live and configured with a GA4 tag. It does not ' +
                'confirm the tag actually fires on every pageview (that needs GTM Preview mode), or ' +
                'that this measurement ID matches the property you are checking in the GA4 app.',
            ''
        );
    } else if (trackingIds.googleTag || tagTypes.includes('Google tag')) {
        // A `GT-` Google tag can forward to GA4 without any `G-` ID appearing
        // in the container, so this is explicitly NOT reported as a failure.
        lines.push(
            '⚠️ **No `G-` GA4 measurement ID, but the container does carry a Google tag** ' +
                `(${trackingIds.googleTag?.join(', ') ?? 'template present'}). A Google tag can ` +
                'forward to a GA4 property without the measurement ID appearing in the container, ' +
                'so this is inconclusive from the outside. Check in Tag Manager which destination ' +
                'that Google tag is configured to send to, and confirm it matches the GA4 property ' +
                'you are looking at.',
            ''
        );
    } else {
        lines.push(
            '❌ **The published GTM container has no GA4 tag in it at all** — no `G-` measurement ' +
                'ID, no `GT-` Google tag, and none of the GA4 tag templates. This fully explains a ' +
                'GA4 property receiving nothing: the container loads correctly on the site, but ' +
                'contains nothing that sends to Analytics.',
            '',
            '> Fix: open Tag Manager → this container → **Tags** → New → *Google Analytics: GA4 ' +
                'Configuration* (or *Google tag*), set the measurement ID, give it the *Initialization ' +
                '- All Pages* or *All Pages* trigger, then **Submit → Publish**. An unpublished ' +
                'workspace is the most common cause: changes saved but never published do not reach ' +
                'the live container, which is what this check reads.',
            ''
        );
        exitCode = 1;
    }

    await report(lines);
    process.exitCode = exitCode;
}

async function report(lines) {
    const text = lines.join('\n');
    console.log('\n' + text);
    if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n');
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((error) => {
        console.error('[verify-tracking] fatal:', error);
        process.exit(1);
    });
}
