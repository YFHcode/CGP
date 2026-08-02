import 'server-only';
import { unstable_cache } from 'next/cache';
import type { NewsItem } from '@/types';

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
 * Throwing inside the cached function keeps failures out of the cache, so a
 * transient provider error can't blank the news section for three hours.
 */
export async function getNews(): Promise<NewsItem[]> {
    try {
        return await cachedNews();
    } catch (error) {
        console.error('[NewsAPI] unavailable:', error instanceof Error ? error.message : error);
        return [];
    }
}
