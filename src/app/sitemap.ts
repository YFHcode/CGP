import type { MetadataRoute } from 'next';
import { getBlogSlugs } from '@/sanity/queries';
import { SITE_URL } from '@/lib/navigation';
import { getHistory, getNewsArchive, groupArchiveByMonth } from '@/lib/prices';
import { listPeriods, slugForKey } from '@/lib/history-periods';
import { notableDaySet } from '@/lib/notable-days';

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
        { url: `${SITE_URL}/gold-price`, changeFrequency: 'daily', priority: 0.85 },
        { url: `${SITE_URL}/silver-price`, changeFrequency: 'daily', priority: 0.85 },
        { url: `${SITE_URL}/news`, changeFrequency: 'daily', priority: 0.8 },
        { url: `${SITE_URL}/news/archive`, changeFrequency: 'daily', priority: 0.6 },
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

    // Price archive: one page per year, month and day we hold data for.
    const history = await getHistory();
    const archiveRoutes: MetadataRoute.Sitemap = (
        [
            ['gold-price', history.gold],
            ['silver-price', history.silver],
        ] as const
    ).flatMap(([base, series]) => [
        ...listPeriods(series, 'year').map((period) => ({
            url: `${SITE_URL}/${base}/${slugForKey(period, 'year')}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        })),
        ...listPeriods(series, 'month').map((period) => ({
            url: `${SITE_URL}/${base}/${slugForKey(period, 'month')}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        })),
        // Only notable days are indexable, so only those belong in the sitemap.
        // Routine day pages remain live, crawlable and internally linked, but
        // listing 1,000 noindex URLs would just burn crawl budget.
        ...listPeriods(series, 'day')
            .filter((period) => notableDaySet(series).has(period))
            .map((period) => ({
            url: `${SITE_URL}/${base}/${slugForKey(period, 'day')}`,
            lastModified: new Date(`${period}T00:00:00Z`),
            changeFrequency: 'yearly' as const,
            priority: 0.5,
        })),
    ]);

    const { items } = await getNewsArchive();
    const newsRoutes: MetadataRoute.Sitemap = [...groupArchiveByMonth(items).keys()].map(
        (month) => ({
            url: `${SITE_URL}/news/archive/${month}`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.5,
        })
    );

    return [...staticRoutes, ...postRoutes, ...archiveRoutes, ...newsRoutes];
}
