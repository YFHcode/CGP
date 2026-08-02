import 'server-only';
import { cache } from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
    GoldPriceResponse,
    HistoryPoint,
    HistorySnapshot,
    MetalSymbol,
    PriceSnapshot,
} from '@/types';
import { getMetalPrice } from './gold-api';

const DATA_DIR = join(process.cwd(), 'data');

/**
 * How stale the committed snapshot may be before we stop trusting it and fall
 * back to a live call. Generous, because a stale real price beats no price.
 */
const MAX_SNAPSHOT_AGE_MS = 36 * 60 * 60 * 1000; // 36 hours

async function readSnapshot<T>(file: string, fallback: T): Promise<T> {
    try {
        return JSON.parse(await readFile(join(DATA_DIR, file), 'utf8')) as T;
    } catch {
        return fallback;
    }
}

/** `react.cache` dedupes reads within a single render pass. */
const readPriceSnapshot = cache(async (): Promise<PriceSnapshot> =>
    readSnapshot<PriceSnapshot>('prices.json', { updatedAt: null, metals: {} })
);

const readHistorySnapshot = cache(async (): Promise<HistorySnapshot> =>
    readSnapshot<HistorySnapshot>('history.json', { updatedAt: null, source: null, series: {} })
);

function isFresh(updatedAt: string | null): boolean {
    if (!updatedAt) return false;
    const age = Date.now() - new Date(updatedAt).getTime();
    return Number.isFinite(age) && age >= 0 && age < MAX_SNAPSHOT_AGE_MS;
}

export interface MetalPrices {
    gold: GoldPriceResponse | null;
    silver: GoldPriceResponse | null;
    /** When the data was last refreshed, for display. Null if unknown. */
    updatedAt: string | null;
    /** True when values came from the committed snapshot rather than a live call. */
    fromSnapshot: boolean;
}

/**
 * Single entry point for spot prices.
 *
 * Reads the committed snapshot first — that path costs zero API quota no matter
 * how much traffic, how many build workers, or how many regions are running.
 * Only an empty or stale snapshot triggers the live fallback.
 */
export const getPrices = cache(async (): Promise<MetalPrices> => {
    const snapshot = await readPriceSnapshot();
    const gold = snapshot.metals?.XAU ?? null;
    const silver = snapshot.metals?.XAG ?? null;

    if (gold && silver && isFresh(snapshot.updatedAt)) {
        return { gold, silver, updatedAt: snapshot.updatedAt, fromSnapshot: true };
    }

    // Sequential on purpose. The provider throttles at 5 requests/second, and
    // this path only runs before the first scheduled refresh, so halving the
    // burst matters more than the extra round-trip.
    const liveGold = await getMetalPrice('XAU');
    const liveSilver = await getMetalPrice('XAG');

    // Prefer live, but never discard a snapshot value in favour of a null.
    const resolvedGold = liveGold ?? gold;
    const resolvedSilver = liveSilver ?? silver;
    const usedLive = Boolean(liveGold || liveSilver);

    return {
        gold: resolvedGold,
        silver: resolvedSilver,
        updatedAt: usedLive ? new Date().toISOString() : snapshot.updatedAt,
        fromSnapshot: !usedLive,
    };
});

/** Convenience accessor for a single metal. */
export async function getPrice(symbol: MetalSymbol): Promise<GoldPriceResponse | null> {
    const { gold, silver } = await getPrices();
    return symbol === 'XAU' ? gold : silver;
}

export interface MetalHistory {
    gold: HistoryPoint[];
    silver: HistoryPoint[];
    source: string | null;
    updatedAt: string | null;
}

/** Historical daily closes, read from the committed snapshot. Never hits network. */
export const getHistory = cache(async (): Promise<MetalHistory> => {
    const snapshot = await readHistorySnapshot();
    return {
        gold: snapshot.series?.XAU ?? [],
        silver: snapshot.series?.XAG ?? [],
        source: snapshot.source ?? null,
        updatedAt: snapshot.updatedAt ?? null,
    };
});

export interface NewsArchiveEntry {
    title: string;
    link: string;
    source: string;
    reportedDate: string | null;
    seenAt: string;
}

export interface NewsArchive {
    updatedAt: string | null;
    items: NewsArchiveEntry[];
}

/**
 * Archived news links, newest first.
 *
 * Holds only headline, publisher, date and URL — never article text or
 * images, which remain the publishers' property.
 */
export const getNewsArchive = cache(async (): Promise<NewsArchive> => {
    const snapshot = await readSnapshot<NewsArchive>('news-archive.json', {
        updatedAt: null,
        items: [],
    });
    return { updatedAt: snapshot.updatedAt ?? null, items: snapshot.items ?? [] };
});

/** Groups archived links by the YYYY-MM they were first seen. */
export function groupArchiveByMonth(items: NewsArchiveEntry[]): Map<string, NewsArchiveEntry[]> {
    const byMonth = new Map<string, NewsArchiveEntry[]>();
    for (const item of items) {
        const month = String(item.seenAt).slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(month)) continue;
        const bucket = byMonth.get(month);
        if (bucket) bucket.push(item);
        else byMonth.set(month, [item]);
    }
    return byMonth;
}
