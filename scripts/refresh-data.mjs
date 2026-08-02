#!/usr/bin/env node
/**
 * Refreshes data/prices.json and data/history.json.
 *
 * This is the ONLY thing that talks to the upstream price APIs. It runs on a
 * schedule in CI (see .github/workflows/refresh-data.yml) and commits the
 * resulting JSON, so the Next.js app never spends API quota at build or request
 * time. Upstream usage is therefore a fixed cost per run, independent of
 * traffic, deploys, build workers and serverless regions.
 *
 * Failure policy: a source that fails leaves the previously committed data
 * untouched rather than overwriting it with nothing, so the site keeps serving
 * last-known-good values.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'data');
const PRICES_FILE = join(DATA_DIR, 'prices.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

const GOLD_API_KEY = process.env.GOLD_API_KEY || 'goldapi-n4hsmi9298tt-io';
// Overridable so the pipeline can be exercised against a local stub.
const GOLD_API_URL = process.env.GOLD_API_URL || 'https://www.goldapi.io/api';

/** Stooq serves free daily OHLC as CSV with no key and no documented rate limit. */
const STOOQ_URL = process.env.STOOQ_URL || 'https://stooq.com/q/d/l/';
const STOOQ_SYMBOLS = { XAU: 'xauusd', XAG: 'xagusd' };

/** Roughly five years of trading days — enough for the 1Y range with headroom. */
const MAX_HISTORY_POINTS = 1300;

const SYMBOLS = ['XAU', 'XAG'];

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in refresh-data.test.mjs)
// ---------------------------------------------------------------------------

/**
 * Parses a Stooq daily CSV export into ascending [{ date, close }].
 * Rows that are malformed or carry non-numeric closes (Stooq emits "N/A" for
 * missing sessions) are dropped rather than poisoning the series with NaN.
 */
export function parseStooqCsv(text, maxPoints = MAX_HISTORY_POINTS) {
    if (typeof text !== 'string' || text.trim() === '') return [];

    const lines = text.trim().split(/\r?\n/);
    const header = lines[0]?.toLowerCase() ?? '';
    if (!header.startsWith('date')) return [];

    const dateIdx = header.split(',').indexOf('date');
    const closeIdx = header.split(',').indexOf('close');
    if (dateIdx === -1 || closeIdx === -1) return [];

    const points = [];
    for (const line of lines.slice(1)) {
        const cols = line.split(',');
        const date = cols[dateIdx]?.trim();
        const close = Number.parseFloat(cols[closeIdx]);

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (!Number.isFinite(close) || close <= 0) continue;

        points.push({ date, close });
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    return points.slice(-maxPoints);
}

/**
 * Merges a freshly fetched series into the stored one, keyed by date, so a
 * source that only returns a short window still extends the long-term history
 * we have already accumulated instead of truncating it.
 */
export function mergeSeries(existing = [], incoming = [], maxPoints = MAX_HISTORY_POINTS) {
    const byDate = new Map();
    for (const point of existing) {
        if (point && typeof point.date === 'string' && Number.isFinite(point.close)) {
            byDate.set(point.date, point.close);
        }
    }
    // Incoming wins on conflict: it is the more recent read of that session.
    for (const point of incoming) {
        if (point && typeof point.date === 'string' && Number.isFinite(point.close)) {
            byDate.set(point.date, point.close);
        }
    }

    return [...byDate.entries()]
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-maxPoints);
}

/** Validates that a GoldAPI payload actually carries a usable price. */
export function isValidQuote(data) {
    return Boolean(
        data &&
        typeof data === 'object' &&
        Number.isFinite(data.price) &&
        data.price > 0
    );
}

/**
 * Derives a synthetic history point from a live quote, so that even without a
 * historical provider the series still grows by one real observation per run.
 */
export function quoteToHistoryPoint(quote, now = new Date()) {
    if (!isValidQuote(quote)) return null;
    return { date: now.toISOString().slice(0, 10), close: quote.price };
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

async function readJson(file, fallback) {
    try {
        return JSON.parse(await readFile(file, 'utf8'));
    } catch {
        return fallback;
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchQuote(symbol) {
    const res = await fetchWithTimeout(`${GOLD_API_URL}/${symbol}/USD`, {
        headers: { 'x-access-token': GOLD_API_KEY, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        throw new Error(`GoldAPI ${symbol}: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (!isValidQuote(data)) {
        throw new Error(`GoldAPI ${symbol}: response carried no usable price`);
    }
    return data;
}

async function fetchHistory(symbol) {
    const url = `${STOOQ_URL}?s=${STOOQ_SYMBOLS[symbol]}&i=d`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`Stooq ${symbol}: ${res.status} ${res.statusText}`);
    }
    const points = parseStooqCsv(await res.text());
    if (points.length === 0) {
        throw new Error(`Stooq ${symbol}: parsed zero usable rows`);
    }
    return points;
}

async function main() {
    await mkdir(DATA_DIR, { recursive: true });

    const prices = await readJson(PRICES_FILE, { updatedAt: null, metals: {} });
    const history = await readJson(HISTORY_FILE, { updatedAt: null, source: null, series: {} });

    prices.metals ??= {};
    history.series ??= {};

    const failures = [];
    let pricesChanged = false;
    let historyChanged = false;

    for (const symbol of SYMBOLS) {
        // --- Spot quote -------------------------------------------------
        let quote = null;
        try {
            quote = await fetchQuote(symbol);
            prices.metals[symbol] = quote;
            pricesChanged = true;
            console.log(`[refresh] ${symbol} spot = ${quote.price}`);
        } catch (error) {
            failures.push(String(error.message ?? error));
            console.error(`[refresh] spot failed for ${symbol}: ${error.message ?? error}`);
        }

        // --- Historical series ------------------------------------------
        try {
            const incoming = await fetchHistory(symbol);
            history.series[symbol] = mergeSeries(history.series[symbol], incoming);
            history.source = 'Stooq';
            historyChanged = true;
            console.log(`[refresh] ${symbol} history = ${history.series[symbol].length} points`);
        } catch (error) {
            failures.push(String(error.message ?? error));
            console.error(`[refresh] history failed for ${symbol}: ${error.message ?? error}`);

            // Fall back to appending today's live quote so the series still grows.
            const point = quoteToHistoryPoint(quote);
            if (point) {
                history.series[symbol] = mergeSeries(history.series[symbol], [point]);
                history.source ??= 'ChartGoldPrice daily snapshots';
                historyChanged = true;
                console.log(`[refresh] ${symbol} history extended from live quote instead`);
            }
        }
    }

    if (pricesChanged) {
        prices.updatedAt = new Date().toISOString();
        await writeFile(PRICES_FILE, JSON.stringify(prices, null, 2) + '\n');
    }
    if (historyChanged) {
        history.updatedAt = new Date().toISOString();
        await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
    }

    if (!pricesChanged && !historyChanged) {
        // Nothing was refreshed at all — surface it so the scheduled run goes red.
        console.error('[refresh] every source failed; existing data left untouched');
        process.exitCode = 1;
        return;
    }

    if (failures.length > 0) {
        console.warn(`[refresh] completed with ${failures.length} partial failure(s)`);
    }
    console.log('[refresh] done');
}

// Only run when executed directly, so tests can import the pure helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((error) => {
        console.error('[refresh] fatal:', error);
        process.exit(1);
    });
}
