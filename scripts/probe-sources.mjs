#!/usr/bin/env node
/**
 * Probes every data source this project uses or could use, and reports what
 * actually works.
 *
 * Runs in CI because GitHub runners have unrestricted outbound internet, so
 * this is the only place these endpoints can genuinely be tested. It writes a
 * Markdown table to the workflow summary.
 *
 * It never mutates data/. It is a diagnostic, not part of the data pipeline.
 */
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseStooqCsv, parseYahooChart } from './refresh-data.mjs';

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';

const TIMEOUT_MS = 20000;

// Plausible spot ranges, used to catch inverted rates (some APIs quote
// XAU-per-USD, ~0.0004) and unit mistakes (per-gram quoted as per-ounce).
const PLAUSIBLE = {
    XAU: { min: 500, max: 20000, label: 'gold USD/oz' },
    XAG: { min: 3, max: 500, label: 'silver USD/oz' },
};

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in probe-sources.test.mjs)
// ---------------------------------------------------------------------------

const PRICE_KEY = /^(price|spot|rate|last|close|ask|value|usd)$/i;

/**
 * Walks arbitrary JSON looking for a plausible price field, so a source can be
 * evaluated without hardcoding its schema.
 * Returns { value, path } or null.
 */
export function extractPrice(payload, maxDepth = 6) {
    const results = [];

    const walk = (node, path, depth) => {
        if (depth > maxDepth || node === null || node === undefined) return;

        if (Array.isArray(node)) {
            node.slice(0, 10).forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
            return;
        }

        if (typeof node !== 'object') return;

        for (const [key, value] of Object.entries(node)) {
            const nextPath = path ? `${path}.${key}` : key;

            if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                if (PRICE_KEY.test(key)) {
                    results.push({ value, path: nextPath, keyMatch: true });
                } else if (/^(xau|xag|gold|silver)$/i.test(key)) {
                    results.push({ value, path: nextPath, keyMatch: true });
                }
            } else if (typeof value === 'object') {
                walk(value, nextPath, depth + 1);
            }
        }
    };

    walk(payload, '', 0);

    if (results.length === 0) return null;
    // Prefer the shallowest match — top-level "price" beats a nested one.
    results.sort((a, b) => a.path.split('.').length - b.path.split('.').length);
    return { value: results[0].value, path: results[0].path };
}

/**
 * Judges whether a number looks like a real spot price, and detects the two
 * common traps: inverted quotes and per-gram values sold as per-ounce.
 */
export function assessPrice(value, symbol) {
    const range = PLAUSIBLE[symbol];
    if (!range) return { ok: false, note: 'unknown symbol' };
    if (!Number.isFinite(value) || value <= 0) return { ok: false, note: 'not a number' };

    if (value >= range.min && value <= range.max) {
        return { ok: true, note: `plausible ${range.label}` };
    }

    // 1/value landing in range means the source quotes metal-per-USD.
    const inverted = 1 / value;
    if (inverted >= range.min && inverted <= range.max) {
        return { ok: false, note: `INVERTED — quotes ${symbol}/USD, use 1/x (≈${inverted.toFixed(2)})` };
    }

    // Gram prices are ~31x smaller than ounce prices.
    const asOunce = value * 31.1034768;
    if (asOunce >= range.min && asOunce <= range.max) {
        return { ok: false, note: `PER-GRAM — multiply by 31.1 (≈${asOunce.toFixed(2)}/oz)` };
    }

    return { ok: false, note: `implausible for ${range.label} (expected ${range.min}–${range.max})` };
}

/** Formats one probe result as a Markdown table row. */
export function formatRow(result) {
    const icon = result.ok ? '✅' : result.status === 'skipped' ? '⏭️' : '❌';
    const price = result.price !== null && result.price !== undefined
        ? String(Number(result.price).toFixed(2))
        : '—';
    const detail = (result.note ?? '').replace(/\|/g, '\\|').slice(0, 90);
    return `| ${icon} | ${result.name} | ${result.kind} | ${result.httpStatus ?? '—'} | ${result.ms ?? '—'} | ${price} | ${detail} |`;
}

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

async function timedFetch(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = Date.now();
    try {
        const res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: { 'User-Agent': 'ChartGoldPrice-SourceProbe/1.0', ...(options.headers ?? {}) },
        });
        return { res, ms: Date.now() - started };
    } finally {
        clearTimeout(timer);
    }
}

/** Probes a JSON endpoint and validates the price it returns. */
async function probeJson({ name, kind, url, symbol, headers, requiresKey }) {
    if (requiresKey) {
        return { name, kind, ok: false, status: 'skipped', note: 'no API key configured — set the secret to test' };
    }

    try {
        const { res, ms } = await timedFetch(url, { headers });
        const text = await res.text();

        if (!res.ok) {
            return {
                name, kind, ok: false, httpStatus: res.status, ms,
                note: text.slice(0, 90).replace(/\s+/g, ' '),
            };
        }

        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            return { name, kind, ok: false, httpStatus: res.status, ms, note: 'response was not JSON' };
        }

        const found = extractPrice(payload);
        if (!found) {
            const keys = Object.keys(payload ?? {}).slice(0, 6).join(', ');
            return { name, kind, ok: false, httpStatus: res.status, ms, note: `no price field found (keys: ${keys})` };
        }

        const verdict = assessPrice(found.value, symbol);
        return {
            name, kind, ok: verdict.ok, httpStatus: res.status, ms,
            price: found.value,
            note: `${found.path} — ${verdict.note}`,
        };
    } catch (error) {
        const message = error.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(error.message ?? error);
        return { name, kind, ok: false, note: message.slice(0, 90) };
    }
}

/** Probes a CSV history endpoint through the same parser the pipeline uses. */
async function probeCsv({ name, kind, url, symbol }) {
    try {
        const { res, ms } = await timedFetch(url);
        const text = await res.text();

        if (!res.ok) {
            return { name, kind, ok: false, httpStatus: res.status, ms, note: text.slice(0, 90).replace(/\s+/g, ' ') };
        }

        // Parse with the production parser, so this tests our code too.
        const points = parseStooqCsv(text);
        if (points.length === 0) {
            return {
                name, kind, ok: false, httpStatus: res.status, ms,
                note: `parser found 0 rows (body starts: ${text.slice(0, 50).replace(/\s+/g, ' ')})`,
            };
        }

        const latest = points.at(-1);
        const verdict = assessPrice(latest.close, symbol);
        return {
            name, kind, ok: verdict.ok, httpStatus: res.status, ms,
            price: latest.close,
            note: `${points.length} rows, ${points[0].date}→${latest.date} — ${verdict.note}`,
        };
    } catch (error) {
        const message = error.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(error.message ?? error);
        return { name, kind, ok: false, note: message.slice(0, 90) };
    }
}

/**
 * Probes a Yahoo chart endpoint through the production parser.
 *
 * The generic JSON extractor cannot read this shape — closes live in a bare
 * number array under indicators.quote[0].close — so it needs its own probe.
 */
async function probeYahoo({ name, kind, url, symbol }) {
    try {
        const { res, ms } = await timedFetch(url);
        const text = await res.text();

        if (!res.ok) {
            return { name, kind, ok: false, httpStatus: res.status, ms, note: text.slice(0, 90).replace(/\s+/g, ' ') };
        }

        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            return { name, kind, ok: false, httpStatus: res.status, ms, note: 'response was not JSON' };
        }

        const points = parseYahooChart(payload);
        if (points.length === 0) {
            const err = payload?.chart?.error;
            return {
                name, kind, ok: false, httpStatus: res.status, ms,
                note: `parser found 0 rows${err ? ` (chart.error: ${JSON.stringify(err).slice(0, 50)})` : ''}`,
            };
        }

        const latest = points.at(-1);
        const verdict = assessPrice(latest.close, symbol);
        return {
            name, kind, ok: verdict.ok, httpStatus: res.status, ms,
            price: latest.close,
            note: `${points.length} rows, ${points[0].date}→${latest.date} — ${verdict.note}`,
        };
    } catch (error) {
        const message = error.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(error.message ?? error);
        return { name, kind, ok: false, note: message.slice(0, 90) };
    }
}

/** Generic reachability probe for sources with no price to validate. */
async function probeReachable({ name, kind, url, headers, requiresKey, expectKey }) {
    if (requiresKey) {
        return { name, kind, ok: false, status: 'skipped', note: 'no API key configured — set the secret to test' };
    }
    try {
        const { res, ms } = await timedFetch(url, { headers });
        const text = await res.text();
        if (!res.ok) {
            return { name, kind, ok: false, httpStatus: res.status, ms, note: text.slice(0, 90).replace(/\s+/g, ' ') };
        }
        let payload;
        try {
            payload = JSON.parse(text);
        } catch {
            return { name, kind, ok: false, httpStatus: res.status, ms, note: 'response was not JSON' };
        }
        const hasKey = expectKey ? Object.prototype.hasOwnProperty.call(payload, expectKey) : true;
        const count = Array.isArray(payload?.[expectKey]) ? payload[expectKey].length : undefined;
        return {
            name, kind, ok: hasKey, httpStatus: res.status, ms,
            note: hasKey
                ? `ok${count !== undefined ? ` — ${count} items` : ''}`
                : `missing expected field "${expectKey}" (keys: ${Object.keys(payload ?? {}).slice(0, 6).join(', ')})`,
        };
    } catch (error) {
        const message = error.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(error.message ?? error);
        return { name, kind, ok: false, note: message.slice(0, 90) };
    }
}

// ---------------------------------------------------------------------------
// Source catalogue
// ---------------------------------------------------------------------------

function buildProbes() {
    // `||` not `??`: an unset GitHub secret arrives as an empty string, which
    // `??` passes straight through and produces a keyless request (401).
    const goldKey = process.env.GOLD_API_KEY || 'goldapi-n4hsmi9298tt-io';
    const serpKey =
        process.env.SERPAPI_KEY || '7bd3fa1bd4a4cbe1452cee498d65f1a4669dd235b5f021bca1e406ae917ca727';
    const currencyKey =
        process.env.CURRENCY_API_KEY || 'fca_live_Ik8ZCBK09jDNbxQPqYHaD6q4WyEtJqu9Qw80hoPr';

    return {
        /** Sources the site depends on right now. A failure here is actionable. */
        current: [
            {
                run: () => probeJson({
                    name: 'GoldAPI.io (XAU)', kind: 'spot',
                    url: 'https://www.goldapi.io/api/XAU/USD', symbol: 'XAU',
                    headers: { 'x-access-token': goldKey },
                }),
            },
            {
                run: () => probeJson({
                    name: 'GoldAPI.io (XAG)', kind: 'spot',
                    url: 'https://www.goldapi.io/api/XAG/USD', symbol: 'XAG',
                    headers: { 'x-access-token': goldKey },
                }),
            },
            {
                run: () => probeYahoo({
                    name: 'Yahoo XAUUSD=X (history)', kind: 'history',
                    url: `${YAHOO}/${encodeURIComponent('XAUUSD=X')}?range=2y&interval=1d`,
                    symbol: 'XAU',
                }),
            },
            {
                run: () => probeYahoo({
                    name: 'Yahoo XAGUSD=X (history)', kind: 'history',
                    url: `${YAHOO}/${encodeURIComponent('XAGUSD=X')}?range=2y&interval=1d`,
                    symbol: 'XAG',
                }),
            },
            {
                run: () => probeReachable({
                    name: 'FreeCurrencyAPI', kind: 'fx',
                    url: `https://api.freecurrencyapi.com/v1/latest?apikey=${currencyKey}&base_currency=USD&currencies=EUR,GBP`,
                    expectKey: 'data',
                }),
            },
            {
                run: () => probeReachable({
                    name: 'SerpAPI (news)', kind: 'news',
                    url: `https://serpapi.com/search.json?api_key=${serpKey}&engine=google&q=gold+price+news&tbm=nws&gl=us&hl=en`,
                    expectKey: 'news_results',
                }),
            },
        ],

        /**
         * Candidate replacements. Failures here are informational — several use
         * bot protection that may block CI but not a browser.
         */
        alternatives: [
            {
                run: () => probeJson({
                    name: 'gold-api.com (XAU)', kind: 'spot',
                    url: 'https://api.gold-api.com/price/XAU', symbol: 'XAU',
                }),
            },
            {
                run: () => probeJson({
                    name: 'gold-api.com (XAG)', kind: 'spot',
                    url: 'https://api.gold-api.com/price/XAG', symbol: 'XAG',
                }),
            },
            {
                run: () => probeJson({
                    name: 'goldprice.org (feed)', kind: 'spot',
                    url: 'https://data-asg.goldprice.org/dbXRates/USD', symbol: 'XAU',
                }),
            },
            {
                run: () => probeJson({
                    name: 'xaus.com', kind: 'spot',
                    url: 'https://xaus.com/api/spot/XAU/USD', symbol: 'XAU',
                }),
            },
            {
                run: () => probeJson({
                    name: 'metals.dev (free tier)', kind: 'spot',
                    url: 'https://api.metals.dev/v1/latest?api_key=demo&currency=USD&unit=toz',
                    symbol: 'XAU', requiresKey: !process.env.METALS_DEV_KEY,
                }),
            },
            {
                run: () => probeYahoo({
                    name: 'Yahoo GC=F (gold futures)', kind: 'history',
                    url: `${YAHOO}/${encodeURIComponent('GC=F')}?range=2y&interval=1d`,
                    symbol: 'XAU',
                }),
            },
            {
                run: () => probeYahoo({
                    name: 'Yahoo SI=F (silver futures)', kind: 'history',
                    url: `${YAHOO}/${encodeURIComponent('SI=F')}?range=2y&interval=1d`,
                    symbol: 'XAG',
                }),
            },
            {
                run: () => probeCsv({
                    name: 'Stooq (XAU daily)', kind: 'history',
                    url: 'https://stooq.com/q/d/l/?s=xauusd&i=d', symbol: 'XAU',
                }),
            },
            {
                run: () => probeReachable({
                    name: 'Frankfurter (FX, no key)', kind: 'fx',
                    url: 'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY',
                    expectKey: 'rates',
                }),
            },
            {
                run: () => probeReachable({
                    name: 'open.er-api.com (FX, no key)', kind: 'fx',
                    url: 'https://open.er-api.com/v6/latest/USD',
                    expectKey: 'rates',
                }),
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TABLE_HEADER = [
    '| | Source | Type | HTTP | ms | Price | Detail |',
    '| --- | --- | --- | --- | --- | --- | --- |',
].join('\n');

async function runGroup(probes) {
    // Sequential: several of these are rate-limited and parallel hits look abusive.
    const results = [];
    for (const probe of probes) {
        results.push(await probe.run());
    }
    return results;
}

async function main() {
    const { current, alternatives } = buildProbes();

    console.log('Probing current sources...');
    const currentResults = await runGroup(current);
    console.log('Probing alternatives...');
    const altResults = await runGroup(alternatives);

    const lines = [
        '## Data source verification',
        '',
        `Run at ${new Date().toISOString()}${process.env.GITHUB_ACTIONS ? ' from a GitHub runner' : ' locally'}.`,
        '',
        '### Sources currently in use',
        '',
        TABLE_HEADER,
        ...currentResults.map(formatRow),
        '',
        '### Candidate alternatives',
        '',
        'Informational only. A failure here may just mean the provider blocks CI traffic.',
        '',
        TABLE_HEADER,
        ...altResults.map(formatRow),
        '',
    ];

    const brokenCurrent = currentResults.filter((r) => !r.ok && r.status !== 'skipped');
    if (brokenCurrent.length > 0) {
        lines.push(
            `> **${brokenCurrent.length} source(s) in use are failing:** ` +
            brokenCurrent.map((r) => r.name).join(', '),
            ''
        );
    } else {
        lines.push('> All in-use sources responded correctly.', '');
    }

    const workingAlts = altResults.filter((r) => r.ok);
    if (workingAlts.length > 0) {
        lines.push(
            `> **${workingAlts.length} alternative(s) verified working:** ` +
            workingAlts.map((r) => `${r.name} (${r.ms}ms)`).join(', '),
            ''
        );
    }

    const report = lines.join('\n');
    console.log('\n' + report);

    if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n');
    }

    // Only in-use sources gate the run; a dead alternative is not a failure.
    if (brokenCurrent.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((error) => {
        console.error('[probe] fatal:', error);
        process.exit(1);
    });
}
