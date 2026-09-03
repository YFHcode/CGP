import type { MetadataRoute } from "next";
import { getBlogSlugs } from "@/sanity/queries";
import { SITE_URL } from "@/lib/navigation";
import { getHistory, getNewsArchive, groupArchiveByMonth } from "@/lib/prices";
import {
  getPeriodStats,
  listPeriods,
  parsePeriod,
  slugForKey,
} from "@/lib/history-periods";
import { notableDaySet } from "@/lib/notable-days";
import { CURRENCY_PAGES } from "@/lib/currency-pages";
import { UNIT_PAGES } from "@/lib/unit-pages";
import { LOCALE_PAGES } from "@/lib/locale-pages";
import { COINS } from "@/lib/coins";
import type { HistoryPoint } from "@/types";

/**
 * Sitemap including blog posts, which were previously omitted entirely.
 * changeFrequency now matches the real refresh cadence rather than claiming
 * "hourly" for data that updates twice a day.
 */
/**
 * Which day-archive pages are advertised in the sitemap.
 *
 * The backfill makes roughly 6,900 day pages per metal renderable instead of
 * ~770. Listing every one would take this sitemap past 14,000 URLs in a single
 * step, on a domain where 3,422 impressions a week already sit at position 51+
 * earning no clicks. So the listing opens deliberately, in three bands:
 *
 *  - ARCHIVE_DAY_FROM: the recent era, where dated queries actually convert
 *    ("gold price on 18 september 2024" ranks at position 3.6).
 *  - ARCHIVE_DAY_YEARS: individual historical years Search Console shows real
 *    demand for. These seven carry the bulk of the pre-2024 year-specific
 *    impressions, so they earn their listing on evidence rather than on the
 *    assumption that more URLs is better.
 *  - Notable days: record highs and lows, each year's and month's extremes, and
 *    the largest single-day moves, wherever they fall.
 *
 * The third band exists because the first two described a bound the rest of the
 * site did not honour. The milestone timeline on /gold-price-insights and
 * /silver-price-insights links every notable day directly, which put 1,199 day
 * pages across eighteen otherwise-excluded years one click from an indexed
 * page — crawlable and discovered, but with no lastmod or priority to crawl
 * them by. Withholding the listing did not withhold the crawl; it only
 * withheld the signal. These are also the day pages most worth indexing: a
 * record high or a 3% session is the one kind of day whose page says something
 * no other page on the site says.
 *
 * Ordinary days outside all three bands still render and stay reachable — they
 * are simply not advertised until they have a reason to be. The two configured
 * bands are env-overridable, so widening later is a config change rather than a
 * code change.
 *
 * One gap between listing and linking remains by design: each day page links to
 * the day before and after it, so an unlisted neighbour is always one click
 * from a listed page. Closing that would mean listing all ~12,900 day pages,
 * which is the outcome these bands exist to avoid. Sequential navigation is not
 * promotion; the milestone timeline was, which is why only that one was
 * reconciled.
 */
/**
 * Every day page is now advertised, reversing the bands described above.
 *
 * Those bands were set on the assumption that a young domain would drown if
 * given twelve thousand dated URLs at once. Search Console says the opposite,
 * and specifically for this page type. Over 24 hours the archive day pages
 * averaged position 13.4 and the current-year ones 7.5, while "other pages"
 * averaged 49.3 and human-typed queries overall 52.2. The position-51+ problem
 * that motivated the bands was never these pages; they are the best-ranking
 * page type on the site.
 *
 * Worse, the bands were costing rankings we had already won. The two
 * highest-impression pages in that export — /gold-price/2-september-2021 at
 * position 8 with 287 impressions, and /silver-price/2-september-2022 at
 * position 5 with 188 — are both from years the bands excluded. They were only
 * indexed because the milestone timeline happened to link them. And a search
 * for "gold price 6 may 2010" returns this site third with the *month* page,
 * because 6 May 2010 is a real Thursday session whose day page exists, renders
 * the correct $1,196.90, and was simply never listed.
 *
 * So the default lists everything. ARCHIVE_DAY_FROM and ARCHIVE_DAY_YEARS
 * still narrow it, which is why they were made env-overridable in the first
 * place: if indexation stalls — day-page impressions rising while average
 * position drifts past 30 — this can be tightened again without a deploy.
 */
const ARCHIVE_DAY_FROM = process.env.ARCHIVE_DAY_FROM || "0000-01-01";

const ARCHIVE_DAY_YEARS = new Set(
  (process.env.ARCHIVE_DAY_YEARS || "2005,2008,2011,2012,2016,2019,2020")
    .split(",")
    .map((year) => year.trim())
    .filter(Boolean),
);

/**
 * Whether one day-archive period is advertised. Exported so the rule that
 * decides what gets published is testable on its own, rather than only
 * observable by diffing a generated sitemap.
 *
 * `notable` is passed in rather than derived here because deriving it re-walks
 * the entire series; the caller computes it once per metal and reuses it.
 */
export function isListedArchiveDay(
  periodKey: string,
  notable: ReadonlySet<string> = new Set(),
  from: string = ARCHIVE_DAY_FROM,
  years: Set<string> = ARCHIVE_DAY_YEARS,
): boolean {
  if (typeof periodKey !== "string" || periodKey.length < 4) return false;
  if (periodKey >= from) return true;
  if (years.has(periodKey.slice(0, 4))) return true;
  return notable.has(periodKey);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const routes = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1.0 },
    {
      url: `${SITE_URL}/gold-price-today`,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/silver-price-today`,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/gold-price-calculator`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/gold-scrap-calculator`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/gold-price-api`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/platinum-price`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/palladium-price`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/silver-price-calculator`,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/gold-to-silver-ratio`,
      changeFrequency: "daily",
      priority: 0.85,
    },
    { url: `${SITE_URL}/charts/gold`, changeFrequency: "daily", priority: 0.9 },
    {
      url: `${SITE_URL}/charts/silver`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/gold-price-history`,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/silver-price-history`,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/gold-price-insights`,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/silver-price-insights`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    // Omitted entirely until now: both forecast pages shipped, were linked
    // from the homepage and were crawlable, but were never advertised.
    {
      url: `${SITE_URL}/gold-price-forecast`,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/silver-price-forecast`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    { url: `${SITE_URL}/gold-price`, changeFrequency: "daily", priority: 0.85 },
    {
      url: `${SITE_URL}/silver-price`,
      changeFrequency: "daily",
      priority: 0.85,
    },
    { url: `${SITE_URL}/news`, changeFrequency: "daily", priority: 0.8 },
    {
      url: `${SITE_URL}/news/archive`,
      changeFrequency: "daily",
      priority: 0.6,
    },
    { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.75 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
    {
      url: `${SITE_URL}/privacy-policy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ] as const;

  const staticRoutes: MetadataRoute.Sitemap = routes.map((entry) => ({
    ...entry,
    lastModified: now,
  }));

  const slugs = await getBlogSlugs();
  const postRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
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
      ["gold-price", history.gold],
      ["silver-price", history.silver],
    ] as const
  ).flatMap(([base, series]) => [
    ...listPeriods(series, "year").map((period) => ({
      url: `${SITE_URL}/${base}/${slugForKey(period, "year")}`,
      lastModified: periodLastModified(series, period),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...listPeriods(series, "month").map((period) => ({
      url: `${SITE_URL}/${base}/${slugForKey(period, "month")}`,
      lastModified: periodLastModified(series, period),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Every day is indexable now that each carries a real, computed
    // headline and week/month/year narrative rather than a bare stats
    // table. Notable days (records, big moves) get a higher priority —
    // they're the ones actually worth a crawler's first look — and are
    // listed wherever they fall, since the insights timeline links them all.
    //
    // notableDaySet is computed once outside the map: it re-derives every
    // record and big-move in the whole series, so calling it per-day would
    // make sitemap generation scale quadratically with history length.
    ...(() => {
      const notable = notableDaySet(series);
      return listPeriods(series, "day")
        .filter((period) => isListedArchiveDay(period, notable))
        .map((period) => ({
          url: `${SITE_URL}/${base}/${slugForKey(period, "day")}`,
          lastModified: new Date(`${period}T00:00:00Z`),
          changeFrequency: "yearly" as const,
          priority: notable.has(period) ? 0.5 : 0.3,
        }));
    })(),
  ]);

  const topicRoutes: MetadataRoute.Sitemap = [
    ...UNIT_PAGES.map((page) => ({
      url: `${SITE_URL}/gold-price-per/${page.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
    ...UNIT_PAGES.map((page) => ({
      url: `${SITE_URL}/silver-price-per/${page.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...CURRENCY_PAGES.map((page) => ({
      url: `${SITE_URL}/gold-price-in/${page.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
    {
      url: `${SITE_URL}/melt-value`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...COINS.map((coin) => ({
      url: `${SITE_URL}/melt-value/${coin.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  const localeRoutes: MetadataRoute.Sitemap = [
    // Not in LOCALE_PAGES: /uk is the English-language British page
    // (src/app/uk/page.tsx), not a translated counterpart of one.
    {
      url: `${SITE_URL}/uk`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    },
    ...LOCALE_PAGES.map((page) => ({
      url: `${SITE_URL}/${page.locale}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  const { items } = await getNewsArchive();
  const newsRoutes: MetadataRoute.Sitemap = [
    ...groupArchiveByMonth(items).keys(),
  ].map((month) => ({
    url: `${SITE_URL}/news/archive/${month}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...topicRoutes,
    ...localeRoutes,
    ...postRoutes,
    ...archiveRoutes,
    ...newsRoutes,
  ];
}
