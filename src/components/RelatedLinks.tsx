import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface RelatedLink {
    href: string;
    /** Descriptive anchor text. Avoid "click here" — the words carry the SEO signal. */
    label: string;
    description: string;
}

interface RelatedLinksProps {
    title?: string;
    links: RelatedLink[];
}

/**
 * Contextual internal links.
 *
 * Internal linking spreads authority between pages and gives crawlers keyword
 * context through the anchor text, so each entry uses a descriptive phrase
 * rather than a bare URL or a generic call to action.
 */
export function RelatedLinks({ title = 'Explore more', links }: RelatedLinksProps) {
    if (links.length === 0) return null;

    return (
        <section aria-labelledby="related-heading" className="bg-zinc-900/30 py-12">
            <div className="container mx-auto px-4">
                <h2 id="related-heading" className="mb-6 text-center text-2xl font-bold text-white">
                    {title}
                </h2>
                <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {links.map((link) => (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                className="group flex h-full flex-col rounded-lg border border-white/10 bg-black/40 p-5 transition-all hover:border-gold-500/30 hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                            >
                                <span className="mb-2 flex items-center gap-2 font-semibold text-white transition-colors group-hover:text-gold-300">
                                    {link.label}
                                    <ArrowRight
                                        className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                                        aria-hidden="true"
                                    />
                                </span>
                                <span className="text-sm text-zinc-300">{link.description}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

/**
 * Canonical descriptions for every linkable page, so anchor text stays
 * consistent site-wide instead of drifting per page.
 *
 * A page missing from this library is a page no other page's body copy can
 * link to. That is how the forecast, API, platinum and palladium pages ended
 * up with one in-content inbound link each while /silver-price-today had 46 —
 * they shipped after the library was written and were never added to it, so
 * they were reachable only from the header, the footer and the homepage. Any
 * new page belongs here as part of shipping it.
 */
export const LINK_LIBRARY: Record<string, RelatedLink> = {
    home: {
        href: '/',
        label: 'Gold & silver dashboard',
        description: 'Live spot prices for both metals, the gold-to-silver ratio and market news.',
    },
    goldToday: {
        href: '/gold-price-today',
        label: "Today's gold price",
        description: 'Gold spot price per ounce, gram and kilogram with the day range in 8 currencies.',
    },
    silverToday: {
        href: '/silver-price-today',
        label: "Today's silver price",
        description: 'Silver spot price per ounce, gram and kilogram, and how it differs from gold.',
    },
    calculator: {
        href: '/gold-price-calculator',
        label: 'Gold value calculator',
        description: 'Work out what your jewellery or bullion is worth by weight and karat purity.',
    },
    history: {
        href: '/gold-price-history',
        label: 'Gold price history',
        description: 'Historical charts from one week to the full available record.',
    },
    goldChart: {
        href: '/charts/gold',
        label: 'Gold price chart',
        description: 'Interactive XAU chart with the day range and gold-to-silver ratio.',
    },
    silverChart: {
        href: '/charts/silver',
        label: 'Silver price chart',
        description: 'Interactive XAG chart with the day range and gold-to-silver ratio.',
    },
    ratio: {
        href: '/gold-to-silver-ratio',
        label: 'Gold to silver ratio',
        description: 'How many ounces of silver buy one ounce of gold, with its range and average.',
    },
    perGram: {
        href: '/gold-price-per/gram',
        label: 'Gold price per gram',
        description: 'The gram price jewellers and scrap buyers quote from, broken down by karat.',
    },
    perOunce: {
        href: '/gold-price-per/ounce',
        label: 'Gold price per ounce',
        description: 'The troy ounce price bullion coins and bars are sold by.',
    },
    silverCalculator: {
        href: '/silver-price-calculator',
        label: 'Silver value calculator',
        description: 'Value silver by weight and fineness, from sterling to fine bullion.',
    },
    goldInInr: {
        href: '/gold-price-in/inr',
        label: 'Gold price in INR',
        description: 'Gold in Indian rupees per gram, tola and 10 grams, with karat rates.',
    },
    goldInGbp: {
        href: '/gold-price-in/gbp',
        label: 'Gold price in GBP',
        description: 'Gold in pounds sterling per gram, ounce and kilogram.',
    },
    meltValue: {
        href: '/melt-value',
        label: 'Coin melt values',
        description: 'Junk silver calculator plus melt values for US and bullion coins.',
    },
    scrapCalculator: {
        href: '/gold-scrap-calculator',
        label: 'Scrap gold calculator',
        description: 'What scrap gold is worth, and what refiners and jewellers actually pay.',
    },
    goldUk: {
        href: '/uk',
        label: 'Gold price UK',
        description: 'UK gold price per gram and ounce, with hallmark purity (375, 585, 750, 916).',
    },
    goldArchive: {
        href: '/gold-price',
        label: 'Gold price archive',
        description: 'Gold prices by year, month and day, with highs, lows and averages.',
    },
    silverArchive: {
        href: '/silver-price',
        label: 'Silver price archive',
        description: 'Silver prices by year, month and day, with highs, lows and averages.',
    },
    goldInsights: {
        href: '/gold-price-insights',
        label: 'Gold price insights',
        description: 'Moving averages, volatility, drawdowns, annual returns, seasonality and records.',
    },
    silverInsights: {
        href: '/silver-price-insights',
        label: 'Silver price insights',
        description: 'Moving averages, volatility, drawdowns, annual returns, seasonality and records.',
    },
    silverHistory: {
        href: '/silver-price-history',
        label: 'Silver price history',
        description: 'Historical silver charts, annual returns and the deepest drawdowns on record.',
    },
    silverPerGram: {
        href: '/silver-price-per/gram',
        label: 'Silver price per gram',
        description: 'Sterling (.925), fine (.999) and coin-silver values by weight.',
    },
    goldPerTola: {
        href: '/gold-price-per/tola',
        label: 'Gold price per tola',
        description: 'The tola and bhori rate used across India, Pakistan, Bangladesh and the Gulf.',
    },
    newsArchive: {
        href: '/news/archive',
        label: 'News archive',
        description: 'Dated index of gold market headlines, linking to the original publishers.',
    },
    news: {
        href: '/news',
        label: 'Precious metals news',
        description: 'Latest headlines moving gold and silver markets, refreshed through the day.',
    },
    blog: {
        href: '/blog',
        label: 'Market analysis blog',
        description: 'Explainers on how precious metals are priced and what drives them.',
    },
    goldForecast: {
        href: '/gold-price-forecast',
        label: 'Gold price forecast',
        description: 'A 7-day gold projection with 80% and 95% ranges, and its measured accuracy.',
    },
    silverForecast: {
        href: '/silver-price-forecast',
        label: 'Silver price forecast',
        description: 'A 7-day silver projection with 80% and 95% ranges, and its measured accuracy.',
    },
    api: {
        href: '/gold-price-api',
        label: 'Free gold price API',
        description: 'JSON spot prices and daily closes since 2000. No key, no rate limit, CORS on.',
    },
    platinum: {
        href: '/platinum-price',
        label: 'Platinum price',
        description: 'Platinum spot price per ounce and gram, with what drives its demand.',
    },
    palladium: {
        href: '/palladium-price',
        label: 'Palladium price',
        description: 'Palladium spot price per ounce and gram, and why it trades so far from gold.',
    },
};

/** Picks entries from the library by key, skipping the current page. */
export function relatedLinks(...keys: (keyof typeof LINK_LIBRARY)[]): RelatedLink[] {
    return keys.map((key) => LINK_LIBRARY[key]).filter(Boolean);
}
