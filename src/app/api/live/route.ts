import { NextResponse } from 'next/server';

import { isMetalsMarketOpen, marketClosedReason } from '@/lib/market-hours';

/**
 * Live spot prices for the on-page ticker.
 *
 * Why this exists rather than the browser calling gold-api.com directly, which
 * it could (they send CORS headers): the provider asks callers to cache for 30
 * seconds, and a direct-from-browser design makes that impossible to honour —
 * upstream load would scale with visitor count, and one popular day would earn
 * the IP block their docs warn about. Proxying puts a single cache in front of
 * them, so upstream sees at most ~2 requests a minute no matter how many
 * people are watching.
 *
 * It also keeps the ticker honest about staleness: the response carries the
 * provider's own updatedAt, so the UI can say how old the number really is
 * rather than implying the poll time is the quote time.
 *
 * Failure policy: never 500. A ticker that errors is worse than one that stops
 * updating, because the page already shows a valid snapshot price from the
 * server render. On upstream failure this returns ok:false and the client
 * keeps what it has.
 */

const UPSTREAM = process.env.GOLD_API_COM_URL || 'https://api.gold-api.com/price';

/** Matches the 30s the provider asks callers to cache for. */
const CACHE_SECONDS = 30;

const TIMEOUT_MS = 5000;

export const dynamic = 'force-dynamic';

interface LiveQuote {
    price: number;
    updatedAt: string | null;
}

/**
 * In-process throttle, deliberately not left to the framework's fetch cache.
 *
 * The provider blocks IPs that poll too hard, so the safe behaviour has to be
 * guaranteed rather than inferred from cache semantics that change between
 * Next versions and between `force-dynamic` and static rendering. Measured
 * locally, the fetch cache alone let 10 rapid requests through as 2 upstream
 * calls; this makes it 1.
 *
 * Scope is one server instance: under serverless fan-out each instance keeps
 * its own entry, so the true upper bound is one call per instance per window.
 * The CDN's s-maxage below is what collapses that further in production —
 * this is the floor, not the whole story.
 */
const memo = new Map<string, { at: number; value: LiveQuote | null }>();
const inflight = new Map<string, Promise<LiveQuote | null>>();

async function fetchMetal(symbol: 'XAU' | 'XAG'): Promise<LiveQuote | null> {
    const cached = memo.get(symbol);
    if (cached && Date.now() - cached.at < CACHE_SECONDS * 1000) {
        return cached.value;
    }
    // Coalesce concurrent misses so a burst opens one upstream request, not one
    // per caller.
    const existing = inflight.get(symbol);
    if (existing) return existing;

    const task = fetchUpstream(symbol)
        .then((value) => {
            memo.set(symbol, { at: Date.now(), value });
            return value;
        })
        .finally(() => inflight.delete(symbol));

    inflight.set(symbol, task);
    return task;
}

async function fetchUpstream(symbol: 'XAU' | 'XAG'): Promise<LiveQuote | null> {
    try {
        const res = await fetch(`${UPSTREAM}/${symbol}`, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: 'no-store',
        });
        if (!res.ok) return null;

        const data = await res.json();
        const price = Number(data?.price);
        if (!Number.isFinite(price) || price <= 0) return null;

        return {
            price,
            updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
        };
    } catch {
        // Network error, timeout, or malformed JSON. The caller treats a null
        // exactly like a failed metal, so there is nothing useful to log here
        // on a path that runs every 30 seconds.
        return null;
    }
}

export async function GET() {
    const open = isMetalsMarketOpen();

    const [gold, silver] = await Promise.all([fetchMetal('XAU'), fetchMetal('XAG')]);

    const body = {
        ok: gold !== null || silver !== null,
        marketOpen: open,
        marketClosedReason: marketClosedReason(),
        fetchedAt: new Date().toISOString(),
        gold,
        silver,
        source: 'gold-api.com',
    };

    return NextResponse.json(body, {
        headers: {
            // s-maxage is what actually protects the provider: the CDN serves
            // every visitor within the window from one upstream fetch.
            'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=120`,
        },
    });
}
