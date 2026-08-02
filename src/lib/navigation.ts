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
    { href: '/news', label: 'News' },
    { href: '/blog', label: 'Blog' },
];

/** Secondary links. Previously these were all dead `href="#"` anchors. */
export const RESOURCE_NAV: NavLink[] = [
    { href: '/about', label: 'About us' },
    { href: '/contact', label: 'Contact' },
    { href: '/privacy-policy', label: 'Privacy policy' },
    { href: '/terms', label: 'Terms of service' },
];

export const SITE_NAME = 'ChartGoldPrice';
export const SITE_URL = 'https://chartgoldprice.com';
