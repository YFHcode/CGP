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

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in verify-tracking.test.mjs)
// ---------------------------------------------------------------------------

/** Pulls the GTM container ID out of the inline bootstrap snippet in the page HTML. */
export function extractGtmId(html) {
    const match = html.match(/googletagmanager\.com\/gtm\.js\?id=([A-Z0-9-]+)/i);
    return match ? match[1] : null;
}

/** Finds every GA4 measurement ID (G-XXXXXXXXXX) compiled into a published GTM container. */
export function extractMeasurementIds(gtmJs) {
    const matches = gtmJs.match(/G-[A-Z0-9]{6,}/g) ?? [];
    return [...new Set(matches)];
}

/** Finds every direct gtag.js measurement ID referenced in the page HTML itself. */
export function extractInlineMeasurementIds(html) {
    const matches = html.match(/G-[A-Z0-9]{6,}/g) ?? [];
    return [...new Set(matches)];
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

async function timedFetch(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = Date.now();
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'ChartGoldPrice-TrackingProbe/1.0' },
        });
        const text = await res.text();
        return { res, text, ms: Date.now() - started };
    } finally {
        clearTimeout(timer);
    }
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
        lines.push(`❌ **Site unreachable** — ${error.message ?? error}.`, '');
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
        const { res, text, ms } = await timedFetch(gtmUrl);
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
        lines.push(`❌ **Could not fetch the GTM container** — ${error.message ?? error}.`, '');
        await report(lines);
        process.exitCode = 1;
        return;
    }

    const measurementIds = extractMeasurementIds(gtmJs);
    if (measurementIds.length === 0) {
        lines.push(
            '❌ **The published GTM container has no GA4 measurement ID compiled into it.** ' +
                'This is consistent with GA4 showing no data: either the GA4 Configuration tag was ' +
                'never added, was removed, or the workspace with it was never published to the live ' +
                'version. Open Tag Manager, confirm a GA4 Configuration tag exists and fires on all ' +
                'pages, then Submit/Publish.',
            ''
        );
        exitCode = 1;
    } else {
        lines.push(
            `✅ Published container references GA4 measurement ID(s): ${measurementIds.join(', ')}.`,
            ''
        );
        lines.push(
            '> This confirms the container is live and configured with a GA4 tag. It does not ' +
                'confirm the tag actually fires on every pageview (that needs GTM Preview mode), or ' +
                'that this measurement ID matches the property you are checking in the GA4 app.',
            ''
        );
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
