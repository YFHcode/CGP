import 'server-only';
import { unstable_cache } from 'next/cache';
import { GoldPriceResponse, MetalSymbol } from '@/types';

// Kept in source deliberately (free tier). Env var wins when present so the key
// can be rotated without a code change.
const API_KEY = process.env.GOLD_API_KEY || 'goldapi-n4hsmi9298tt-io';
const BASE_URL = 'https://www.goldapi.io/api';

/** 8 hours. */
const REVALIDATE_SECONDS = 28800;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The provider throttles at 5 requests/second and answers 429 past that. */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

async function fetchMetalPrice(symbol: MetalSymbol, attempt = 1): Promise<GoldPriceResponse> {
    const response = await fetch(`${BASE_URL}/${symbol}/USD`, {
        method: 'GET',
        headers: {
            'x-access-token': API_KEY,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');

        // Back off and retry rather than surfacing a transient throttle as a
        // missing price. Without this a burst of page renders during a cold
        // build can blank every price card in the generated HTML.
        if (RETRY_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
            const delay = 500 * 2 ** (attempt - 1); // 500ms, 1s, 2s
            console.warn(
                `[GoldAPI] ${symbol} got ${response.status}; retrying in ${delay}ms (attempt ${attempt}/${MAX_ATTEMPTS})`
            );
            await sleep(delay);
            return fetchMetalPrice(symbol, attempt + 1);
        }

        throw new Error(
            `GoldAPI ${symbol}: ${response.status} ${response.statusText} ${errorText}`.trim()
        );
    }

    const data: GoldPriceResponse = await response.json();

    // A 200 with no usable price still has to count as a failure, otherwise a
    // quota-exceeded body gets cached as if it were a real quote.
    if (!Number.isFinite(data?.price) || data.price <= 0) {
        throw new Error(`GoldAPI ${symbol}: response carried no usable price`);
    }

    return data;
}

/**
 * Cache wrappers are built once at module scope, not per call. Building them
 * inside the exported function created a fresh cache handle on every request.
 */
const cachedFetchers: Record<MetalSymbol, () => Promise<GoldPriceResponse>> = {
    XAU: unstable_cache(() => fetchMetalPrice('XAU'), ['metal-price-XAU-USD'], {
        revalidate: REVALIDATE_SECONDS,
        tags: ['price-XAU'],
    }),
    XAG: unstable_cache(() => fetchMetalPrice('XAG'), ['metal-price-XAG-USD'], {
        revalidate: REVALIDATE_SECONDS,
        tags: ['price-XAG'],
    }),
};

/**
 * Single-flight guard.
 *
 * `unstable_cache` does not coalesce concurrent misses, so during a cold build
 * every page rendering at once fires its own request — which is what tripped
 * the provider's 5 req/sec throttle. Sharing the in-flight promise collapses
 * those to one request per symbol per process.
 */
const inFlight = new Map<MetalSymbol, Promise<GoldPriceResponse | null>>();

/**
 * Live fallback, used only when `data/prices.json` has not been populated yet
 * (fresh clone, before the first scheduled refresh).
 *
 * Errors are thrown inside the cached function and caught out here on purpose:
 * throwing stops `unstable_cache` from storing the failure, so one bad response
 * no longer blanks the site for the whole revalidate window.
 */
export async function getMetalPrice(symbol: MetalSymbol): Promise<GoldPriceResponse | null> {
    const existing = inFlight.get(symbol);
    if (existing) return existing;

    const request = cachedFetchers[symbol]()
        .catch((error: unknown) => {
            console.error(
                `[GoldAPI] ${symbol} unavailable:`,
                error instanceof Error ? error.message : error
            );
            return null;
        })
        .finally(() => {
            inFlight.delete(symbol);
        });

    inFlight.set(symbol, request);
    return request;
}
