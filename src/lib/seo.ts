import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from './navigation';

export { SITE_NAME, SITE_URL };

/**
 * The generated social card at src/app/opengraph-image.tsx, referenced by URL.
 * 1200x630 is the size that file declares and the one every major platform
 * crops to.
 */
const OG_IMAGE = `${SITE_URL}/opengraph-image`;
const OG_IMAGE_ALT = 'ChartGoldPrice — gold and silver price charts';

interface PageMetaOptions {
    title: string;
    description: string;
    /** Path relative to the site root, e.g. "/gold-price-today". */
    path: string;
    keywords?: string[];
    /** Omit from search results (used for utility pages). */
    noIndex?: boolean;
    type?: 'website' | 'article';
    publishedTime?: string;
}

/**
 * Builds per-page metadata with an explicit canonical URL.
 *
 * The root layout used to declare `alternates.canonical: '/'`, which Next
 * inherits down the tree — so every page told search engines the homepage was
 * its canonical version. Each page now sets its own.
 */
export function pageMetadata({
    title,
    description,
    path,
    keywords,
    noIndex = false,
    type = 'website',
    publishedTime,
}: PageMetaOptions): Metadata {
    const url = `${SITE_URL}${path}`;
    const fullTitle = path === '/' ? title : `${title} | ${SITE_NAME}`;

    return {
        title,
        description,
        keywords,
        alternates: { canonical: url },
        robots: noIndex ? { index: false, follow: true } : undefined,
        openGraph: {
            title: fullTitle,
            description,
            url,
            siteName: SITE_NAME,
            type,
            locale: 'en_US',
            /**
             * Stated explicitly rather than relying on inheritance.
             *
             * Next fills in a file-based opengraph-image automatically, but
             * only for routes that do not declare `openGraph` themselves.
             * Because this helper always declares one, every page that used it
             * — which is every page except the homepage — silently shipped no
             * og:image at all, so any link shared to Reddit, WhatsApp, Slack or
             * X rendered as a bare grey box. `twitter.card` was set to
             * `summary_large_image` all the while, promising an image that was
             * never there.
             */
            images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
            ...(publishedTime ? { publishedTime } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [OG_IMAGE],
        },
    };
}

interface BreadcrumbEntry {
    name: string;
    path: string;
}

interface DatasetOptions {
    name: string;
    description: string;
    /** Path relative to the site root, e.g. "/gold-price-history". */
    path: string;
    keywords: string[];
    /** What the numbers actually are, e.g. "Gold price (USD per troy ounce)". */
    variableMeasured: string;
    /** ISO interval "YYYY-MM-DD/YYYY-MM-DD". Omitted when the series is empty. */
    temporalCoverage?: string | null;
    /**
     * Machine-readable copies of the data. Every contentUrl must actually be
     * fetchable — Google Dataset Search follows them, and advertising a
     * download that 404s is worse than advertising none.
     */
    distribution?: { encodingFormat: string; contentUrl: string }[];
}

/**
 * schema.org/Dataset markup, which is what Google Dataset Search indexes.
 *
 * Dataset Search is a free, permanent distribution channel for exactly the
 * asset this site has and most competitors don't — a price record reaching
 * back to 2000 — and it requires no submission, only correct markup. Describe
 * the cadence honestly via describeCoverage: Dataset Search's audience is
 * data consumers, who will notice. This was previously
 * present on /silver-price-history alone, so the gold series and the API were
 * both invisible to it.
 *
 * Centralised rather than copied per page: the same "filter, then spread a
 * literal" pattern duplicated across three files is how the hreflang cluster
 * drifted earlier, and a Dataset block is long enough that a fourth copy
 * would drift the same way.
 */
export function datasetSchema({
    name,
    description,
    path,
    keywords,
    variableMeasured,
    temporalCoverage,
    distribution,
}: DatasetOptions) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name,
        description,
        url: `${SITE_URL}${path}`,
        license: `${SITE_URL}/terms`,
        isAccessibleForFree: true,
        keywords,
        variableMeasured,
        creator: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
        },
        ...(temporalCoverage ? { temporalCoverage } : {}),
        ...(distribution && distribution.length > 0
            ? {
                  distribution: distribution.map((d) => ({
                      '@type': 'DataDownload',
                      encodingFormat: d.encodingFormat,
                      contentUrl: d.contentUrl,
                  })),
              }
            : {}),
    };
}

/** BreadcrumbList schema matching the current page, not a hardcoded trail. */
export function breadcrumbSchema(entries: BreadcrumbEntry[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: 'Home', path: '/' }, ...entries].map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.name,
            item: `${SITE_URL}${entry.path}`,
        })),
    };
}

export function organizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.png`,
        description:
            'Gold and silver spot prices with historical charts, a karat value calculator and market news.',
    };
}

export function websiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: SITE_URL,
        name: SITE_NAME,
        description: 'Track gold and silver prices with interactive charts',
    };
}

/**
 * FAQ schema for the homepage only. It previously rendered site-wide from the
 * root layout, emitting a duplicate FAQPage on every URL.
 */
export function faqSchema(goldPrice?: number | null, updatedAt?: string | null) {
    const priceAnswer =
        typeof goldPrice === 'number' && Number.isFinite(goldPrice)
            ? `Gold is trading at approximately $${goldPrice.toFixed(2)} USD per troy ounce${
                  updatedAt ? ` as of ${new Date(updatedAt).toUTCString()}` : ''
              }. Prices are also available in EUR, GBP, CAD, AUD, JPY, CNY and INR.`
            : 'Current gold prices are shown on our dashboard in eight currencies, updated on a regular schedule.';

    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: 'What is the current gold price?',
                acceptedAnswer: { '@type': 'Answer', text: priceAnswer },
            },
            {
                '@type': 'Question',
                name: 'How often are gold prices updated?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Prices are refreshed on a schedule twice a day and the exact time of the last update is shown beneath the price cards. They are indicative reference prices, not live trading quotes.',
                },
            },
            {
                '@type': 'Question',
                name: 'How do I calculate what my gold is worth?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Weigh your gold, then use our calculator to enter the weight in ounces, grams or kilograms and select its karat purity (24K, 22K, 21K, 18K, 14K or 10K). The result is the melt value at current spot prices, before dealer margins.',
                },
            },
            {
                '@type': 'Question',
                name: 'What is the gold to silver ratio?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'The gold to silver ratio is how many ounces of silver it takes to buy one ounce of gold. It is shown live in the market snapshot section and is used to judge which metal is relatively cheap.',
                },
            },
        ],
    };
}

/** Renders one or more schema objects as JSON-LD script tags. */
export function jsonLdScript(schema: object) {
    return {
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
    };
}
