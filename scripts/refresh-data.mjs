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
const RATES_FILE = join(DATA_DIR, 'rates.json');

/**
 * Splits a comma-separated key list, trimming whitespace and dropping empty
 * entries — so a trailing comma or accidental double-comma in a secret
 * doesn't produce a blank credential that fails every request that reaches
 * it. `||` not `??`: an unset or empty-string env var falls through to the
 * default rather than producing a single blank key.
 */
export function parseApiKeys(envValue, defaultList) {
    const source = envValue || defaultList;
    return source
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
}

/**
 * Multiple free-tier accounts, tried in order.
 *
 * Each GoldAPI free key is capped at 100 requests/month. Two runs/day for
 * two metals is ~122/month — already over a single key's quota, which is
 * exactly what took the primary source down and forced the gold-api.com
 * fallback for three days straight (2026-08-14 to 2026-08-17). Three keys
 * give ~300/month of combined headroom, comfortably covering the schedule.
 *
 * This is a waterfall, not parallel calls: only one quote is needed per
 * request, so trying key 2 is only attempted after key 1 fails (almost
 * always because its month's quota is exhausted), and key 3 only after
 * both of those fail. GOLD_API_KEYS overrides the whole list as a
 * comma-separated string, so a revoked key can be swapped without a code
 * change.
 */
const GOLD_API_KEYS = parseApiKeys(
    process.env.GOLD_API_KEYS,
    [
        'goldapi-n4hsmi9298tt-io',
        'goldapi-9a371fad2ba3dda05b80cbef52a3f66e-io',
        'goldapi-d09a96191256c258ed8dd3f43e675d39-io',
    ].join(',')
);

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
    // NYMEX platinum and palladium futures, the same contract family as the
    // COMEX gold and silver symbols above.
    XPT: ['PL=F'],
    XPD: ['PA=F'],
};

/**
 * Stooq, kept as a secondary history source.
 *
 * As of the last CI verification it answers 200 with an HTML bot-check page
 * rather than CSV, so the parser correctly yields zero rows and we fall
 * through. Left in place in case it starts working again.
 */
const STOOQ_URL = process.env.STOOQ_URL || 'https://stooq.com/q/d/l/';
const STOOQ_SYMBOLS = { XAU: 'xauusd', XAG: 'xagusd', XPT: 'xptusd', XPD: 'xpdusd' };

/**
 * Cap applied when PARSING a provider response, purely to bound one payload.
 * It is not a cap on stored history.
 */
const MAX_PARSE_POINTS = 20000;

/**
 * Stored history is append-only and never trimmed.
 *
 * An earlier version capped it at 1300 points (~3.5 years), which would have
 * silently started dropping the oldest day on every run once reached — and
 * every dropped day is a published archive page that would begin returning
 * 404 after having been indexed. The chart downsamples for display instead, so
 * there is no reason to discard data here.
 */
const MAX_HISTORY_POINTS = Number.POSITIVE_INFINITY;

/** News provider, used only to build a dated index of outbound links. */
const NEWS_URL = process.env.NEWS_URL || 'https://serpapi.com/search.json';
const SERPAPI_KEY =
    process.env.SERPAPI_KEY || '7bd3fa1bd4a4cbe1452cee498d65f1a4669dd235b5f021bca1e406ae917ca727';

/** Cap on archived headlines. Roughly two years at 10 per run, twice a day. */
const MAX_NEWS_ITEMS = 5000;

/**
 * Exchange rates, stored so per-currency pages can be rendered on the server.
 * Client-side conversion alone would leave the prices out of the HTML, which is
 * exactly what a crawler reads.
 */
const CURRENCY_URL = process.env.CURRENCY_URL || 'https://api.freecurrencyapi.com/v1/latest';
const CURRENCY_API_KEY =
    process.env.CURRENCY_API_KEY || 'fca_live_Ik8ZCBK09jDNbxQPqYHaD6q4WyEtJqu9Qw80hoPr';
const RATE_CURRENCIES = ['EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR'];

/**
 * Metals fetched every run. Platinum and palladium ride the same quote and
 * history paths as gold and silver; only the pages built on top of them
 * differ, because karat purity and the gold-silver ratio don't apply.
 */
const SYMBOLS = ['XAU', 'XAG', 'XPT', 'XPD'];

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in refresh-data.test.mjs)
// ---------------------------------------------------------------------------

/**
 * Builds a USD-based rate map from gold-api.com price responses.
 *
 * That provider returns the FX rate it used alongside every converted quote,
 * which makes it a second opinion on rates at no extra cost — worth having,
 * because when the primary rates provider fails the per-currency pages fall
 * back to a stale snapshot and eventually to USD-only.
 *
 * The guard that matters is the currency check. If the provider ever ignores
 * the currency path segment and answers in USD, the payload still looks
 * perfectly valid — exchangeRate 1, price sensible — and accepting it would
 * record INR = 1 and quote Indian prices at the dollar figure. Every entry
 * must therefore come back in the currency it was asked for.
 */
export function collectExchangeRates(entries) {
    const clean = { USD: 1 };
    if (!Array.isArray(entries)) return clean;

    for (const entry of entries) {
        const requested = typeof entry?.requested === 'string' ? entry.requested.toUpperCase() : '';
        const payload = entry?.payload;
        if (!requested || requested === 'USD' || !payload) continue;

        const answered = typeof payload.currency === 'string' ? payload.currency.toUpperCase() : '';
        if (answered !== requested) continue;

        const rate = Number(payload.exchangeRate);
        if (!Number.isFinite(rate) || rate <= 0) continue;

        clean[requested] = rate;
    }

    return clean;
}

/**
 * Years in a series that are too sparse to be daily.
 *
 * A trading year holds roughly 250 sessions; a monthly sample holds 12. The
 * threshold sits far from both, so this is a clean classification rather than
 * a tuned one.
 *
 * This is what keeps the backfill from re-fetching the whole archive twice a
 * day forever: once a year has been filled in it stops being sparse, so steady
 * state is one or two windows per run instead of fourteen.
 */
export function sparseYears(points, { minPerYear = 100, startYear = 1990, endYear } = {}) {
    const last = endYear ?? new Date().getUTCFullYear();
    const counts = new Map();
    for (const point of Array.isArray(points) ? points : []) {
        const year = Number(String(point?.date ?? '').slice(0, 4));
        if (!Number.isInteger(year)) continue;
        counts.set(year, (counts.get(year) ?? 0) + 1);
    }

    // Only consider years the series actually reaches into: backfilling years
    // before a contract existed would fetch empty windows every run.
    const known = [...counts.keys()].filter((y) => Number.isInteger(y));
    const first = known.length > 0 ? Math.min(...known) : last;
    const from = Math.max(startYear, first);

    const sparse = [];
    for (let year = from; year <= last; year++) {
        if ((counts.get(year) ?? 0) < minPerYear) sparse.push(year);
    }
    return sparse;
}

/**
 * Groups years into fetch windows, merging consecutive years so a full
 * backfill costs one request per window rather than one per year.
 */
export function windowsForYears(years, windowYears = 2) {
    const sorted = [...new Set(Array.isArray(years) ? years : [])]
        .filter((y) => Number.isInteger(y))
        .sort((a, b) => a - b);

    const windows = [];
    for (const year of sorted) {
        const open = windows[windows.length - 1];
        // Extend the open window when this year is adjacent and the window has
        // not yet reached its width.
        if (open && year === open.end + 1 && open.end - open.start + 1 < windowYears) {
            open.end = year;
        } else {
            windows.push({ start: year, end: year });
        }
    }
    return windows;
}

/**
 * Parses a Stooq daily CSV export into ascending [{ date, close }].
 * Rows that are malformed or carry non-numeric closes (Stooq emits "N/A" for
 * missing sessions) are dropped rather than poisoning the series with NaN.
 */
export function parseStooqCsv(text, maxPoints = MAX_PARSE_POINTS) {
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
export function parseYahooChart(payload, maxPoints = MAX_PARSE_POINTS) {
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
/**
 * Removes closes dated on a Saturday or Sunday.
 *
 * A futures contract cannot print a close when the exchange is shut, so any
 * such point is an artifact rather than a session. They arrived from the
 * legacy monthly series, which sampled the first calendar day of each month
 * regardless of whether it was a trading day: 44 of gold's 45 weekend-dated
 * points fell on the 1st.
 *
 * They survived the daily backfill because mergeSeries is keyed by date, and a
 * Saturday has no real session to overwrite it. Left in place they are not a
 * cosmetic problem — each sits between two genuine closes at a different
 * price, manufacturing a spike and an equal reversal the next day. Ten of
 * gold's sixteen implausible daily moves involved one, and they inflated the
 * 60-day volatility estimate to 45.8% annualised against a typical 12-18%,
 * which more than doubled the width of every forecast interval on the site.
 */
export function dropNonTradingDays(points) {
    if (!Array.isArray(points)) return [];
    return points.filter((point) => {
        if (!point || typeof point.date !== 'string') return false;
        const day = new Date(`${point.date}T00:00:00Z`).getUTCDay();
        return day !== 0 && day !== 6;
    });
}

/**
 * Removes single points that spike and immediately revert.
 *
 * What is left after the weekend prune are legacy monthly samples that landed
 * on a market holiday — 1 January 2008, US Labor Day 2025 — where the exchange
 * was shut but the calendar day was a weekday, so no genuine session existed to
 * overwrite them. Each sits between two real closes at a price neither
 * neighbour supports.
 *
 * The signature is what makes this safe: an artifact jumps and comes straight
 * back, leaving the neighbours close to each other, whereas a genuine crash
 * moves to a new level and stays. Gold's real 15 April 2013 collapse (-9.8% in
 * a session) is preserved by exactly that test, because the following day moved
 * only +1.9% rather than undoing it.
 *
 * Deliberately conservative. It requires a large move in AND out, in opposite
 * directions, AND neighbours that agree with each other — three conditions,
 * because wrongly deleting a real session is worse than leaving one bad point.
 */
const SPIKE_MOVE = 0.05;
const NEIGHBOUR_AGREEMENT = 0.03;

export function dropSpikes(points) {
    if (!Array.isArray(points) || points.length < 3) return Array.isArray(points) ? points : [];

    const keep = points.map(() => true);
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1].close;
        const here = points[i].close;
        const next = points[i + 1].close;
        if (!(prev > 0 && here > 0 && next > 0)) continue;

        const inMove = Math.log(here / prev);
        const outMove = Math.log(next / here);
        const acrossMove = Math.abs(Math.log(next / prev));

        const spikes = Math.abs(inMove) > SPIKE_MOVE && Math.abs(outMove) > SPIKE_MOVE;
        const reverts = Math.sign(inMove) !== Math.sign(outMove);
        const neighboursAgree = acrossMove < NEIGHBOUR_AGREEMENT;

        if (spikes && reverts && neighboursAgree) keep[i] = false;
    }

    return points.filter((_, i) => keep[i]);
}

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

    const merged = dropSpikes(
        dropNonTradingDays(
            [...byDate.entries()]
                .map(([date, close]) => ({ date, close }))
                .sort((a, b) => a.date.localeCompare(b.date))
        )
    );

    // Number.POSITIVE_INFINITY means "keep everything"; slice(-Infinity) would
    // return an empty array, so guard it explicitly.
    return Number.isFinite(maxPoints) ? merged.slice(-maxPoints) : merged;
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

/**
 * Tries each configured GoldAPI key in order. A 401/403 almost always means
 * that account's monthly quota is spent, not that the credential is invalid,
 * so it is worth trying the next one rather than failing straight to the
 * keyless fallback and losing the richer fields it can't provide.
 */
async function fetchQuoteFromGoldApi(symbol) {
    let lastError;

    for (const key of GOLD_API_KEYS) {
        try {
            const res = await fetchWithTimeout(`${GOLD_API_URL}/${symbol}/USD`, {
                headers: { 'x-access-token': key, 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                lastError = new Error(
                    `GoldAPI ${symbol}: ${res.status} ${res.statusText} ${body}`.trim()
                );
                continue;
            }
            const data = await res.json();
            if (!isValidQuote(data)) {
                lastError = new Error(`GoldAPI ${symbol}: response carried no usable price`);
                continue;
            }
            return data;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError ?? new Error(`GoldAPI ${symbol}: no keys configured`);
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

/**
 * Metals served only by the keyless provider.
 *
 * Not a capability gap — GoldAPI.io quotes platinum and palladium too — but a
 * quota one. Its free keys allow 100 requests/month each; two runs a day
 * across four metals would need ~244 of the ~300 the three keys provide,
 * leaving almost no margin for a retry or an extra run. Gold and silver are
 * the pages that need the richer fields (karat grams, day range), so they keep
 * the metered source and these two take the unmetered one.
 */
const KEYLESS_ONLY_SYMBOLS = new Set(['XPT', 'XPD']);

/** Tries the primary quote source, then the keyless fallback. */
async function fetchQuote(symbol) {
    if (KEYLESS_ONLY_SYMBOLS.has(symbol)) {
        return fetchQuoteFromGoldApiCom(symbol);
    }
    try {
        return await fetchQuoteFromGoldApi(symbol);
    } catch (error) {
        console.warn(`[refresh] primary quote failed for ${symbol}: ${error.message ?? error}`);
        console.warn(`[refresh] trying keyless fallback for ${symbol}...`);
        return fetchQuoteFromGoldApiCom(symbol);
    }
}

/**
 * How much history to request from Yahoo.
 *
 * `max` reaches back to the start of the contract (~2000 for GC=F/SI=F),
 * rather than the two years this used to ask for. Depth is the product here:
 * "10 year silver chart" and "gold prices over time" are real, recurring
 * searches that two years of data cannot answer, and statistics like monthly
 * seasonality are meaningless averaged over two samples.
 *
 * Re-fetching the full range on every run (rather than just the tail) is
 * deliberate: it costs one larger response twice a day, and in exchange the
 * stored series self-heals if it is ever truncated or lost, and upstream
 * corrections to old sessions propagate instead of being frozen in.
 */
const YAHOO_HISTORY_RANGE = 'max';

/**
 * Backfill bounds. 1995 is comfortably before the oldest contract the probe
 * found (platinum reaches 1997-11), and sparseYears() clamps to the years the
 * series actually covers, so an early start costs nothing.
 */
const YAHOO_BACKFILL_START_YEAR = Number(process.env.YAHOO_BACKFILL_START_YEAR || 1995);
const YAHOO_BACKFILL_WINDOW_YEARS = Number(process.env.YAHOO_BACKFILL_WINDOW_YEARS || 2);

async function fetchYahooHistory(symbol, yahooSymbol) {
    const url = `${YAHOO_URL}/${encodeURIComponent(yahooSymbol)}?range=${YAHOO_HISTORY_RANGE}&interval=1d`;
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

/**
 * Backfills the years the stored series holds only monthly samples for.
 *
 * `range=max` looks like it should be the whole archive, and it is — at the
 * wrong resolution. Yahoo silently downsamples long ranges: a CI probe
 * (scripts/probe-history-depth.mjs) measured 267 points across 26 years, with
 * zero weekend-sized gaps, where explicit period1/period2 windows returned
 * 6,525 points over the same span. Same endpoint, same interval parameter,
 * ~24× the data.
 *
 * That mattered because roughly 60% of this site's year-specific search
 * demand points at pre-2024 years — precisely the stretch that was monthly.
 *
 * Only sparse years are fetched, so this costs fourteen requests once and one
 * or two per run thereafter. Windows that fail or come back empty are skipped
 * rather than aborting the run: a partial backfill still improves the series,
 * and mergeSeries is additive so the next run retries whatever is still thin.
 */
async function backfillYahooHistory(symbol, yahooSymbol, existing) {
    const years = sparseYears(existing, { startYear: YAHOO_BACKFILL_START_YEAR });
    if (years.length === 0) return [];

    const windows = windowsForYears(years, YAHOO_BACKFILL_WINDOW_YEARS);
    console.log(
        `[refresh] ${symbol}: ${years.length} sparse year(s), backfilling in ${windows.length} window(s)`
    );

    const collected = [];
    for (const window of windows) {
        // Inclusive of the whole end year.
        const from = Math.floor(Date.UTC(window.start, 0, 1) / 1000);
        const to = Math.floor(Math.min(Date.UTC(window.end + 1, 0, 1), Date.now()) / 1000);
        if (to <= from) continue;

        const url = `${YAHOO_URL}/${encodeURIComponent(yahooSymbol)}?period1=${from}&period2=${to}&interval=1d`;
        try {
            const res = await fetchWithTimeout(url);
            if (!res.ok) {
                console.warn(
                    `[refresh] ${symbol} backfill ${window.start}-${window.end}: ${res.status} ${res.statusText}`
                );
                continue;
            }
            const points = parseYahooChart(await res.json());
            collected.push(...points);
            console.log(
                `[refresh] ${symbol} backfill ${window.start}-${window.end}: ${points.length} pts`
            );
        } catch (error) {
            console.warn(
                `[refresh] ${symbol} backfill ${window.start}-${window.end} failed: ${error.message ?? error}`
            );
        }
        // Yahoo is keyless and unmetered; stay a polite client anyway.
        await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return collected;
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
async function fetchHistory(symbol, existing = []) {
    const attempts = [
        ...YAHOO_SYMBOLS[symbol].map((y) => () => fetchYahooHistory(symbol, y)),
        () => fetchStooqHistory(symbol),
    ];

    const errors = [];
    for (const attempt of attempts) {
        try {
            const result = await attempt();

            // Top up the thin years, if any. Only Yahoo can serve them, so this
            // is skipped when a later provider answered. Failure here is not
            // fatal: the freshly fetched series is already an improvement, and
            // the next run retries whatever is still sparse.
            if (result.source.startsWith('Yahoo')) {
                const yahooSymbol = YAHOO_SYMBOLS[symbol][0];
                // Judge sparseness against what we will actually hold, so a
                // year already dense in the stored file isn't re-fetched just
                // because this response didn't include it.
                const combined = mergeSeries(existing, result.points, MAX_HISTORY_POINTS);
                const filled = await backfillYahooHistory(symbol, yahooSymbol, combined);
                if (filled.length > 0) {
                    return {
                        points: mergeSeries(result.points, filled, MAX_HISTORY_POINTS),
                        source: result.source,
                    };
                }
            }

            return result;
        } catch (error) {
            errors.push(String(error.message ?? error));
        }
    }

    throw new Error(`all history sources failed for ${symbol}: ${errors.join('; ')}`);
}

/** Fetches USD-based exchange rates for the currencies the site offers. */
async function fetchRates() {
    const params = new URLSearchParams({
        apikey: CURRENCY_API_KEY,
        base_currency: 'USD',
        currencies: RATE_CURRENCIES.join(','),
    });

    const res = await fetchWithTimeout(`${CURRENCY_URL}?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`CurrencyAPI: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    const raw = body?.data;
    if (!raw || typeof raw !== 'object') {
        throw new Error('CurrencyAPI: response carried no rates');
    }

    const clean = { USD: 1 };
    for (const [code, value] of Object.entries(raw)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            clean[code] = value;
        }
    }
    if (Object.keys(clean).length <= 1) {
        throw new Error('CurrencyAPI: no usable rates in response');
    }
    return clean;
}

/**
 * Keyless rates fallback, read off gold-api.com's per-currency quotes.
 *
 * One request per currency rather than a single rates call, because that
 * provider exposes FX only as a side effect of a price conversion. Seven
 * requests twice a day is negligible, and this only runs when the primary
 * has already failed.
 */
async function fetchRatesFromGoldApiCom() {
    const entries = await Promise.all(
        RATE_CURRENCIES.map(async (requested) => {
            try {
                const res = await fetchWithTimeout(`${GOLD_API_COM_URL}/XAU/${requested}`);
                if (!res.ok) return { requested, payload: null };
                return { requested, payload: await res.json() };
            } catch {
                return { requested, payload: null };
            }
        })
    );

    const rates = collectExchangeRates(entries);
    if (Object.keys(rates).length <= 1) {
        throw new Error('gold-api.com: no usable rates in responses');
    }
    return rates;
}

/** Primary rates source, then the keyless fallback. */
async function fetchRatesWithFallback() {
    try {
        return { rates: await fetchRates(), source: 'freecurrencyapi.com' };
    } catch (error) {
        console.warn(`[refresh] primary rates failed: ${error.message ?? error}`);
        console.warn('[refresh] trying keyless rates fallback...');
        return { rates: await fetchRatesFromGoldApiCom(), source: 'gold-api.com' };
    }
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
    const rates = await readJson(RATES_FILE, { updatedAt: null, base: 'USD', rates: {} });

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
            // The stored series is passed in so the backfill can tell which
            // years are already dense and skip them.
            const { points, source } = await fetchHistory(symbol, history.series[symbol] ?? []);
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

    // --- Exchange rates --------------------------------------------------
    let ratesChanged = false;
    try {
        const { rates: fetched, source } = await fetchRatesWithFallback();
        rates.rates = fetched;
        rates.base = 'USD';
        rates.source = source;
        ratesChanged = true;
        console.log(
            `[refresh] rates: ${Object.keys(rates.rates).length} currencies from ${source}`
        );
    } catch (error) {
        failures.push(String(error.message ?? error));
        console.error(`[refresh] rates failed: ${error.message ?? error}`);
    }

    if (ratesChanged) {
        rates.updatedAt = new Date().toISOString();
        await writeFile(RATES_FILE, JSON.stringify(rates, null, 2) + '\n');
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

    if (!pricesChanged && !historyChanged && !newsChanged && !ratesChanged) {
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
