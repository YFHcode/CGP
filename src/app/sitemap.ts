import type { MetadataRoute } from 'next';
import { getBlogSlugs } from '@/sanity/queries';
import { SITE_URL } from '@/lib/navigation';
import { getHistory, getNewsArchive, groupArchiveByMonth } from '@/lib/prices';
import { getPeriodStats, listPeriods, parsePeriod, slugForKey } from '@/lib/history-periods';
import { notableDaySet } from '@/lib/notable-days';
import { CURRENCY_PAGES } from '@/lib/currency-pages';
import { UNIT_PAGES } from '@/lib/unit-pages';
import type { HistoryPoint } from '@/types';

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
        { url: `${SITE_URL}/silver-price-calculator`, changeFrequency: 'weekly', priority: 0.85 },
        { url: `${SITE_URL}/gold-to-silver-ratio`, changeFrequency: 'daily', priority: 0.85 },
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

    // The date content in a period actually last changed: its newest data
    // point, not "now". Reporting every archive page as freshly modified on
    // every 5-minute sitemap regeneration — including years that stopped
    // accumulating data long ago — drowns out the signal that would otherwise
    // tell Google which pages are worth recrawling.
    function periodLastModified(series: HistoryPoint[], key: string): Date {
        const period = parsePeriod(key);
        const stats = period ? getPeriodStats(series, period) : null;
        const latest = stats?.points[stats.points.length - 1]?.date;
        return latest ? new Date(`${latest}T00:00:00Z`) : now;
    }

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
            lastModified: periodLastModified(series, period),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        })),
        ...listPeriods(series, 'month').map((period) => ({
            url: `${SITE_URL}/${base}/${slugForKey(period, 'month')}`,
            lastModified: periodLastModified(series, period),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        })),
        // Every day is indexable now that each carries a real, computed
        // headline and week/month/year narrative rather than a bare stats
        // table. Notable days (records, big moves) get a higher priority —
        // they're the ones actually worth a crawler's first look.
        //
        // notableDaySet is computed once outside the map: it re-derives every
        // record and big-move in the whole series, so calling it per-day would
        // make sitemap generation scale quadratically with history length.
        ...(() => {
            const notable = notableDaySet(series);
            return listPeriods(series, 'day').map((period) => ({
                url: `${SITE_URL}/${base}/${slugForKey(period, 'day')}`,
                lastModified: new Date(`${period}T00:00:00Z`),
                changeFrequency: 'yearly' as const,
                priority: notable.has(period) ? 0.5 : 0.3,
            }));
        })(),
    ]);

    const topicRoutes: MetadataRoute.Sitemap = [
        ...UNIT_PAGES.map((page) => ({
            url: `${SITE_URL}/gold-price-per/${page.slug}`,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 0.85,
        })),
        ...CURRENCY_PAGES.map((page) => ({
            url: `${SITE_URL}/gold-price-in/${page.slug}`,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 0.85,
        })),
    ];

    const { items } = await getNewsArchive();
    const newsRoutes: MetadataRoute.Sitemap = [...groupArchiveByMonth(items).keys()].map(
        (month) => ({
            url: `${SITE_URL}/news/archive/${month}`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.5,
        })
    );

    return [...staticRoutes, ...topicRoutes, ...postRoutes, ...archiveRoutes, ...newsRoutes];
}
