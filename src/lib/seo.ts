import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from './navigation';

export { SITE_NAME, SITE_URL };

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
            ...(publishedTime ? { publishedTime } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
    };
}

interface BreadcrumbEntry {
    name: string;
    path: string;
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
