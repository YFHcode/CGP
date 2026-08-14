import 'server-only';
import { unstable_cache } from 'next/cache';
import type { NewsItem } from '@/types';
import { getNewsArchive, type NewsArchiveEntry } from './prices';

// Kept in source deliberately (free tier). Env var wins when present.
const API_KEY =
    process.env.SERPAPI_KEY || '7bd3fa1bd4a4cbe1452cee498d65f1a4669dd235b5f021bca1e406ae917ca727';
const BASE_URL = 'https://serpapi.com/search.json';

/** 3 hours. */
const REVALIDATE_SECONDS = 10800;

/**
 * Parses the provider's date field. Google News returns relative strings
 * ("2 hours ago") as well as absolute dates, so an unparseable value must sort
 * last rather than become NaN and scramble the whole ordering.
 */
function toSortableTime(item: NewsItem): number {
    const raw = item.published_at || item.date;
    const parsed = raw ? new Date(raw).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchNews(): Promise<NewsItem[]> {
    const params = new URLSearchParams({
        api_key: API_KEY,
        engine: 'google',
        q: 'gold price news',
        location: 'United States',
        google_domain: 'google.com',
        gl: 'us',
        hl: 'en',
        tbm: 'nws',
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`SerpAPI: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results: NewsItem[] = Array.isArray(data?.news_results) ? data.news_results : [];

    // Only keep items we can actually render and link to.
    return results
        .filter((item) => item && typeof item.link === 'string' && typeof item.title === 'string')
        .sort((a, b) => toSortableTime(b) - toSortableTime(a));
}

const cachedNews = unstable_cache(fetchNews, ['news-gold-us'], {
    revalidate: REVALIDATE_SECONDS,
    tags: ['news'],
});

/**
 * Below this, treat the live response as degraded and top it up from the
 * archive. A provider that returns one usable story is not an outage — it
 * throws nothing and caches happily — so a plain try/catch never catches it.
 */
const MIN_LIVE_ITEMS = 4;

/**
 * The archive stores link metadata only, so there is no snippet to carry over.
 *
 * `reportedDate` is deliberately ignored: the provider reports relative
 * strings ("3 hours ago"), and every one of the archived entries has one.
 * Replaying that later would date a story archived four days ago as "3 hours
 * ago", and it is unparseable, so it would also sort to the bottom. `seenAt`
 * is a real ISO timestamp, so it is used for both display and ordering.
 */
function archiveToNewsItems(entries: NewsArchiveEntry[]): NewsItem[] {
    return entries.map((entry) => ({
        link: entry.link,
        title: entry.title,
        source: entry.source,
        date: new Date(entry.seenAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
        }),
        published_at: entry.seenAt,
        snippet: '',
    }));
}

/**
 * Latest news, live where possible and backfilled from the committed archive.
 *
 * The live provider is a free tier with a monthly search cap. When that cap is
 * reached it does not fail loudly — it returns a thin result, which rendered
 * as a single lonely card on the homepage. Since every story we have ever
 * shown is already committed to data/news-archive.json by the scheduled
 * refresh, there is no reason to show one card when fifty are on disk.
 *
 * Live items are kept first and deduped by link, so fresh stories still lead
 * and the archive only fills the tail.
 */
export async function getNews(): Promise<NewsItem[]> {
    let live: NewsItem[] = [];

    try {
        live = await cachedNews();
    } catch (error) {
        console.error('[NewsAPI] unavailable:', error instanceof Error ? error.message : error);
    }

    if (live.length >= MIN_LIVE_ITEMS) return live;

    try {
        const { items } = await getNewsArchive();
        const seen = new Set(live.map((item) => item.link));
        const backfill = archiveToNewsItems(items).filter((item) => !seen.has(item.link));

        if (backfill.length > 0) {
            console.warn(
                `[NewsAPI] only ${live.length} live item(s); backfilling ${backfill.length} from the archive`
            );
        }

        // Sort the merged list newest-first. Live items carry absolute
        // timestamps and archived ones carry seenAt, so both are comparable;
        // anything unparseable sorts last rather than scrambling the order.
        return [...live, ...backfill].sort((a, b) => toSortableTime(b) - toSortableTime(a));
    } catch (error) {
        console.error('[NewsAPI] archive fallback failed:', error instanceof Error ? error.message : error);
        return live;
    }
}
