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
const NEWS_FILE = join(DATA_DIR, 'news-archive.json');

const GOLD_API_KEY = process.env.GOLD_API_KEY || 'goldapi-n4hsmi9298tt-io';
// Overridable so the pipeline can be exercised against a local stub.
const GOLD_API_URL = process.env.GOLD_API_URL || 'https://www.goldapi.io/api';

/**
 * Keyless spot source, used as a fallback when the primary is throttled or
 * down. Verified working from CI and its quotes track the primary closely.
 */
const GOLD_API_COM_URL = process.env.GOLD_API_COM_URL || 'https://api.gold-api.com/price';

/**
 * Yahoo's chart endpoint, the primary history source.
 *
 * COMEX front-month futures (GC=F, SI=F) — verified in CI as returning ~502
 * daily closes over two years. The spot FX symbols XAUUSD=X / XAGUSD=X were
 * tried first but Yahoo answers 404 "symbol may be delisted" for both, so they
 * are not used.
 *
 * Futures carry a small basis versus spot (about 1.5% for gold at the time of
 * writing), so the chart is labelled as futures rather than presented as spot.
 */
const YAHOO_URL = process.env.YAHOO_URL || 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SYMBOLS = {
    XAU: ['GC=F'],
    XAG: ['SI=F'],
};

/**
 * Stooq, kept as a secondary history source.
 *
 * As of the last CI verification it answers 200 with an HTML bot-check page
 * rather than CSV, so the parser correctly yields zero rows and we fall
 * through. Left in place in case it starts working again.
 */
const STOOQ_URL = process.env.STOOQ_URL || 'https://stooq.com/q/d/l/';
const STOOQ_SYMBOLS = { XAU: 'xauusd', XAG: 'xagusd' };

/** Roughly five years of trading days — enough for the 1Y range with headroom. */
const MAX_HISTORY_POINTS = 1300;

/** News provider, used only to build a dated index of outbound links. */
const NEWS_URL = process.env.NEWS_URL || 'https://serpapi.com/search.json';
const SERPAPI_KEY =
    process.env.SERPAPI_KEY || '7bd3fa1bd4a4cbe1452cee498d65f1a4669dd235b5f021bca1e406ae917ca727';

/** Cap on archived headlines. Roughly two years at 10 per run, twice a day. */
const MAX_NEWS_ITEMS = 5000;

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
 * Parses Yahoo Finance's chart payload into ascending [{ date, close }].
 *
 * Shape: chart.result[0].timestamp[] pairs positionally with
 * chart.result[0].indicators.quote[0].close[]. Yahoo emits null closes for
 * non-trading sessions, which must be dropped rather than charted as zero.
 */
export function parseYahooChart(payload, maxPoints = MAX_HISTORY_POINTS) {
    const result = payload?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;

    if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

    const points = [];
    const length = Math.min(timestamps.length, closes.length);

    for (let i = 0; i < length; i += 1) {
        const seconds = timestamps[i];
        const close = closes[i];

        if (!Number.isFinite(seconds) || !Number.isFinite(close) || close <= 0) continue;

        const date = new Date(seconds * 1000).toISOString().slice(0, 10);
        points.push({ date, close });
    }

    // Yahoo can return several intraday rows for the same session; keep the last.
    const byDate = new Map(points.map((p) => [p.date, p.close]));

    return [...byDate.entries()]
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-maxPoints);
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
 * Reduces a provider result to a link record.
 *
 * Deliberately keeps only the headline, publisher, date and URL. Snippets and
 * thumbnails are third-party copyrighted content, and republishing them is both
 * an infringement risk and the "scraped content" pattern Google's spam policy
 * penalises. The archive is an index of links out, not a copy of the articles.
 */
export function toArchiveEntry(item, seenAt = new Date()) {
    if (!item || typeof item.link !== 'string' || typeof item.title !== 'string') return null;
    if (item.link.trim() === '' || item.title.trim() === '') return null;

    let host;
    try {
        host = new URL(item.link).hostname.replace(/^www\./, '');
    } catch {
        return null; // Unparseable URL: not something we can link to.
    }

    return {
        title: item.title.trim(),
        link: item.link,
        source: typeof item.source === 'string' && item.source ? item.source : host,
        // The date the provider reported, kept as given; plus when we saw it,
        // which is what the archive is actually ordered by.
        reportedDate: typeof item.date === 'string' ? item.date : null,
        seenAt: seenAt.toISOString(),
    };
}

/**
 * Merges new headlines into the archive, keyed by URL so the same story is not
 * archived twice across runs.
 */
export function mergeNewsArchive(existing = [], incoming = [], maxItems = MAX_NEWS_ITEMS) {
    const byLink = new Map();

    for (const entry of existing) {
        if (entry && typeof entry.link === 'string') byLink.set(entry.link, entry);
    }
    // Keep the first sighting: that is closest to publication.
    for (const entry of incoming) {
        if (entry && typeof entry.link === 'string' && !byLink.has(entry.link)) {
            byLink.set(entry.link, entry);
        }
    }

    return [...byLink.values()]
        .sort((a, b) => String(b.seenAt).localeCompare(String(a.seenAt)))
        .slice(0, maxItems);
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

async function fetchQuoteFromGoldApi(symbol) {
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

/**
 * Keyless fallback. Returns only a price, so the richer fields (day range,
 * previous close, per-karat grams) are derived or left absent.
 */
async function fetchQuoteFromGoldApiCom(symbol) {
    const res = await fetchWithTimeout(`${GOLD_API_COM_URL}/${symbol}`);
    if (!res.ok) {
        throw new Error(`gold-api.com ${symbol}: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const price = Number(data?.price);
    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`gold-api.com ${symbol}: response carried no usable price`);
    }

    const now = Math.floor(Date.now() / 1000);
    return {
        timestamp: now,
        metal: symbol,
        currency: 'USD',
        exchange: 'gold-api.com',
        symbol: `${symbol}USD`,
        // No day range from this provider: report the price rather than invent
        // a high/low. The UI shows a flat range instead of fabricated movement.
        prev_close_price: price,
        open_price: price,
        low_price: price,
        high_price: price,
        open_time: now,
        price,
        ch: 0,
        chp: 0,
        ask: price,
        bid: price,
        price_gram_24k: price / 31.1034768,
        price_gram_22k: (price / 31.1034768) * (22 / 24),
        price_gram_21k: (price / 31.1034768) * (21 / 24),
        price_gram_20k: (price / 31.1034768) * (20 / 24),
        price_gram_18k: (price / 31.1034768) * (18 / 24),
        price_gram_16k: (price / 31.1034768) * (16 / 24),
        price_gram_14k: (price / 31.1034768) * (14 / 24),
        price_gram_10k: (price / 31.1034768) * (10 / 24),
    };
}

/** Tries the primary quote source, then the keyless fallback. */
async function fetchQuote(symbol) {
    try {
        return await fetchQuoteFromGoldApi(symbol);
    } catch (error) {
        console.warn(`[refresh] primary quote failed for ${symbol}: ${error.message ?? error}`);
        console.warn(`[refresh] trying keyless fallback for ${symbol}...`);
        return fetchQuoteFromGoldApiCom(symbol);
    }
}

async function fetchYahooHistory(symbol, yahooSymbol) {
    const url = `${YAHOO_URL}/${encodeURIComponent(yahooSymbol)}?range=2y&interval=1d`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`Yahoo ${yahooSymbol}: ${res.status} ${res.statusText}`);
    }
    const points = parseYahooChart(await res.json());
    if (points.length === 0) {
        throw new Error(`Yahoo ${yahooSymbol}: parsed zero usable rows`);
    }
    // Named so the UI can say what the series actually is, rather than implying
    // these are spot prices.
    return { points, source: 'Yahoo Finance (COMEX futures)' };
}

async function fetchStooqHistory(symbol) {
    const url = `${STOOQ_URL}?s=${STOOQ_SYMBOLS[symbol]}&i=d`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
        throw new Error(`Stooq ${symbol}: ${res.status} ${res.statusText}`);
    }
    const points = parseStooqCsv(await res.text());
    if (points.length === 0) {
        throw new Error(`Stooq ${symbol}: parsed zero usable rows (likely an HTML bot check)`);
    }
    return { points, source: 'Stooq' };
}

/**
 * Tries each history provider in order and returns the first that yields data.
 * Ordered by data quality: Yahoo spot, Yahoo futures, then Stooq.
 */
async function fetchHistory(symbol) {
    const attempts = [
        ...YAHOO_SYMBOLS[symbol].map((y) => () => fetchYahooHistory(symbol, y)),
        () => fetchStooqHistory(symbol),
    ];

    const errors = [];
    for (const attempt of attempts) {
        try {
            return await attempt();
        } catch (error) {
            errors.push(String(error.message ?? error));
        }
    }

    throw new Error(`all history sources failed for ${symbol}: ${errors.join('; ')}`);
}

/** Fetches current headlines. Only link metadata is retained. */
async function fetchNews() {
    const params = new URLSearchParams({
        api_key: SERPAPI_KEY,
        engine: 'google',
        q: 'gold price news',
        location: 'United States',
        google_domain: 'google.com',
        gl: 'us',
        hl: 'en',
        tbm: 'nws',
    });

    const res = await fetchWithTimeout(`${NEWS_URL}?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`SerpAPI: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const results = Array.isArray(data?.news_results) ? data.news_results : [];
    const now = new Date();

    return results.map((item) => toArchiveEntry(item, now)).filter(Boolean);
}

async function main() {
    await mkdir(DATA_DIR, { recursive: true });

    const prices = await readJson(PRICES_FILE, { updatedAt: null, metals: {} });
    const history = await readJson(HISTORY_FILE, { updatedAt: null, source: null, series: {} });
    const newsArchive = await readJson(NEWS_FILE, { updatedAt: null, items: [] });

    prices.metals ??= {};
    history.series ??= {};
    newsArchive.items ??= [];

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
            const { points, source } = await fetchHistory(symbol);
            history.series[symbol] = mergeSeries(history.series[symbol], points);
            history.source = source;
            historyChanged = true;
            console.log(
                `[refresh] ${symbol} history = ${history.series[symbol].length} points (via ${source})`
            );
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

    // --- News archive (link index only) ---------------------------------
    let newsChanged = false;
    try {
        const incoming = await fetchNews();
        const before = newsArchive.items.length;
        newsArchive.items = mergeNewsArchive(newsArchive.items, incoming);
        const added = newsArchive.items.length - before;
        newsChanged = added > 0;
        console.log(`[refresh] news: ${incoming.length} fetched, ${added} new (${newsArchive.items.length} archived)`);
    } catch (error) {
        failures.push(String(error.message ?? error));
        console.error(`[refresh] news failed: ${error.message ?? error}`);
    }

    if (newsChanged) {
        newsArchive.updatedAt = new Date().toISOString();
        await writeFile(NEWS_FILE, JSON.stringify(newsArchive, null, 2) + '\n');
    }

    if (pricesChanged) {
        prices.updatedAt = new Date().toISOString();
        await writeFile(PRICES_FILE, JSON.stringify(prices, null, 2) + '\n');
    }
    if (historyChanged) {
        history.updatedAt = new Date().toISOString();
        await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
    }

    if (!pricesChanged && !historyChanged && !newsChanged) {
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
