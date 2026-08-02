import { client } from './client';
import type { SanityDocument } from 'next-sanity';

export interface BlogPostSummary {
    _id: string;
    title: string;
    slug: { current: string };
    publishedAt?: string;
    excerpt?: string;
    image?: unknown;
}

/**
 * Only the fields the listing renders.
 *
 * This previously fetched every post's full `body` just to slice one line off
 * it for the excerpt — the projection now pulls that single line server-side.
 */
const POSTS_QUERY = `*[_type == "post" && defined(slug.current)]
  | order(publishedAt desc)[0...24]{
    _id, title, slug, publishedAt, image,
    "excerpt": coalesce(excerpt, pt::text(body[0]))
  }`;

const SLUGS_QUERY = `*[_type == "post" && defined(slug.current)]{ "slug": slug.current }`;

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]`;

const options = { next: { revalidate: 300 } };

export async function getBlogPosts(): Promise<BlogPostSummary[]> {
    try {
        return await client.fetch<BlogPostSummary[]>(POSTS_QUERY, {}, options);
    } catch (error) {
        console.error('[Sanity] Failed to fetch posts:', error);
        return [];
    }
}

export async function getBlogSlugs(): Promise<string[]> {
    try {
        const rows = await client.fetch<{ slug: string }[]>(SLUGS_QUERY, {}, options);
        return rows.map((row) => row.slug).filter(Boolean);
    } catch (error) {
        console.error('[Sanity] Failed to fetch slugs:', error);
        return [];
    }
}

export async function getBlogPost(slug: string): Promise<SanityDocument | null> {
    try {
        return await client.fetch<SanityDocument | null>(POST_QUERY, { slug }, options);
    } catch (error) {
        console.error(`[Sanity] Failed to fetch post "${slug}":`, error);
        return null;
    }
}

/** Formats a Sanity publish date, guarding against missing/invalid values. */
export function formatPostDate(value: unknown, style: 'short' | 'long' = 'short'): string | null {
    if (typeof value !== 'string' || value === '') return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;

    return date.toLocaleDateString('en-US',
        style === 'long'
            ? { month: 'long', day: 'numeric', year: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' }
    );
}
