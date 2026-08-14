/** Single source of truth for site navigation. */

export interface NavLink {
    href: string;
    label: string;
}

/** A titled block of links inside a dropdown. */
export interface NavSection {
    title: string;
    links: NavLink[];
}

/** A top-level header item that opens a menu. */
export interface NavGroup {
    label: string;
    /** Where the group's own name points, so the label is itself a real destination. */
    href: string;
    sections: NavSection[];
}

/**
 * Grouped primary navigation.
 *
 * This used to be a flat list of eight links, with everything else reachable
 * only from the footer — a crawl showed the per-unit, per-currency, silver
 * history and silver calculator pages were literally unreachable without
 * scrolling to the bottom of the page. Grouping by metal and by task puts
 * every destination within two clicks of anywhere, and keeps the top bar to
 * five items instead of growing one per page added.
 */
export const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Gold',
        href: '/gold-price-today',
        sections: [
            {
                title: 'Prices & charts',
                links: [
                    { href: '/gold-price-today', label: 'Gold price today' },
                    { href: '/charts/gold', label: 'Gold price chart' },
                    { href: '/gold-price-history', label: 'Gold price history' },
                    { href: '/gold-price-insights', label: 'Gold price insights' },
                    { href: '/gold-price', label: 'Gold price archive' },
                ],
            },
            {
                title: 'By weight',
                links: [
                    { href: '/gold-price-per/gram', label: 'Per gram' },
                    { href: '/gold-price-per/ounce', label: 'Per ounce' },
                    { href: '/gold-price-per/kilo', label: 'Per kilo' },
                    { href: '/gold-price-per/tola', label: 'Per tola' },
                    { href: '/gold-price-per/pavan', label: 'Per pavan' },
                ],
            },
            {
                title: 'By currency',
                links: [
                    { href: '/gold-price-in/inr', label: 'Gold price in INR' },
                    { href: '/gold-price-in/eur', label: 'Gold price in EUR' },
                    { href: '/gold-price-in/gbp', label: 'Gold price in GBP' },
                ],
            },
        ],
    },
    {
        label: 'Silver',
        href: '/silver-price-today',
        sections: [
            {
                title: 'Prices & charts',
                links: [
                    { href: '/silver-price-today', label: 'Silver price today' },
                    { href: '/charts/silver', label: 'Silver price chart' },
                    { href: '/silver-price-history', label: 'Silver price history' },
                    { href: '/silver-price-insights', label: 'Silver price insights' },
                    { href: '/silver-price', label: 'Silver price archive' },
                ],
            },
            {
                title: 'By weight & purity',
                links: [
                    { href: '/silver-price-per/gram', label: 'Per gram' },
                    { href: '/silver-price-per/ounce', label: 'Per ounce' },
                    { href: '/silver-price-per/kilo', label: 'Per kilo' },
                    { href: '/silver-price-per/tola', label: 'Per tola' },
                ],
            },
        ],
    },
    {
        label: 'Tools',
        href: '/gold-price-calculator',
        sections: [
            {
                title: 'Calculators',
                links: [
                    { href: '/gold-price-calculator', label: 'Gold value calculator' },
                    { href: '/silver-price-calculator', label: 'Silver value calculator' },
                    { href: '/melt-value', label: 'Coin melt value calculator' },
                ],
            },
            {
                title: 'Coins',
                links: [
                    { href: '/melt-value/silver-quarter', label: 'Silver quarter value' },
                    { href: '/melt-value/silver-dime', label: 'Silver dime value' },
                    { href: '/melt-value/morgan-silver-dollar', label: 'Morgan dollar value' },
                    { href: '/melt-value/krugerrand', label: 'Krugerrand value' },
                    { href: '/melt-value/gold-sovereign', label: 'Gold sovereign value' },
                ],
            },
            {
                title: 'Compare',
                links: [{ href: '/gold-to-silver-ratio', label: 'Gold to silver ratio' }],
            },
        ],
    },
    {
        label: 'News',
        href: '/news',
        sections: [
            {
                title: 'Market news',
                links: [
                    { href: '/news', label: 'Latest news' },
                    { href: '/news/archive', label: 'News archive' },
                    { href: '/blog', label: 'Analysis blog' },
                ],
            },
        ],
    },
];

/**
 * Flat primary navigation, still used by the footer.
 *
 * Kept as a simple list so the footer stays a plain sitemap-style block; the
 * header uses NAV_GROUPS above.
 */
export const MAIN_NAV: NavLink[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/gold-price-today', label: 'Gold price' },
    { href: '/silver-price-today', label: 'Silver price' },
    { href: '/gold-price-calculator', label: 'Calculator' },
    { href: '/gold-price-history', label: 'History' },
    { href: '/gold-price-insights', label: 'Insights' },
    { href: '/news', label: 'News' },
    { href: '/blog', label: 'Blog' },
];

/** Topic pages, linked from the footer so crawlers always reach them. */
export const TOOLS_NAV: NavLink[] = [
    { href: '/gold-price-per/gram', label: 'Gold price per gram' },
    { href: '/gold-price-per/tola', label: 'Gold price per tola' },
    { href: '/gold-price-per/pavan', label: 'Gold price per pavan' },
    { href: '/silver-price-per/gram', label: 'Silver price per gram' },
    { href: '/gold-to-silver-ratio', label: 'Gold to silver ratio' },
    { href: '/silver-price-calculator', label: 'Silver calculator' },
    { href: '/silver-price-history', label: 'Silver price history' },
    { href: '/gold-price-in/inr', label: 'Gold price in INR' },
    { href: '/gold-price-in/eur', label: 'Gold price in EUR' },
];

/** Archive hubs, linked from the footer so crawlers always reach them. */
export const ARCHIVE_NAV: NavLink[] = [
    { href: '/gold-price', label: 'Gold price archive' },
    { href: '/silver-price', label: 'Silver price archive' },
    { href: '/news/archive', label: 'News archive' },
];

/** Secondary links. Previously these were all dead `href="#"` anchors. */
export const RESOURCE_NAV: NavLink[] = [
    { href: '/about', label: 'About us' },
    { href: '/contact', label: 'Contact' },
    { href: '/privacy-policy', label: 'Privacy policy' },
    { href: '/terms', label: 'Terms of service' },
];

export const SITE_NAME = 'ChartGoldPrice';
/**
 * Canonical origin. MUST match the production domain configured in Vercel.
 *
 * www is the production domain; the bare domain 307-redirects to it. Pointing
 * canonicals and the sitemap at the bare domain would aim every URL at a
 * redirect, wasting crawl budget and splitting signals across two hostnames.
 */
export const SITE_URL = 'https://www.chartgoldprice.com';
