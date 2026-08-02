import type { MetadataRoute } from 'next';
import { getBlogSlugs } from '@/sanity/queries';
import { SITE_URL } from '@/lib/navigation';

/**
 * Sitemap including blog posts, which were previously omitted entirely.
 * changeFrequency now matches the real refresh cadence rather than claiming
 * "hourly" for data that updates twice a day.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const routes = [
        { url: SITE_URL, changeFrequency: 'daily', priority: 1.0 },
        { url: `${SITE_URL}/gold-price-today`, changeFrequency: 'daily', priority: 0.95 },
        { url: `${SITE_URL}/silver-price-today`, changeFrequency: 'daily', priority: 0.95 },
        { url: `${SITE_URL}/gold-price-calculator`, changeFrequency: 'weekly', priority: 0.9 },
        { url: `${SITE_URL}/charts/gold`, changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/charts/silver`, changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/gold-price-history`, changeFrequency: 'daily', priority: 0.85 },
        { url: `${SITE_URL}/news`, changeFrequency: 'daily', priority: 0.8 },
        { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.75 },
        { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.4 },
        { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.4 },
        { url: `${SITE_URL}/privacy-policy`, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    ] as const;

    const staticRoutes: MetadataRoute.Sitemap = routes.map((entry) => ({
        ...entry,
        lastModified: now,
    }));

    const slugs = await getBlogSlugs();
    const postRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
        url: `${SITE_URL}/blog/${slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
    }));

    return [...staticRoutes, ...postRoutes];
}
