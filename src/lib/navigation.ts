/** Single source of truth for site navigation. */

export interface NavLink {
    href: string;
    label: string;
}

/** Primary navigation, shown in the header and repeated in the footer. */
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
    { href: '/gold-price-per/ounce', label: 'Gold price per ounce' },
    { href: '/gold-to-silver-ratio', label: 'Gold to silver ratio' },
    { href: '/silver-price-calculator', label: 'Silver calculator' },
    { href: '/silver-price-insights', label: 'Silver price insights' },
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
