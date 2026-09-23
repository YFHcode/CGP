import type { Metadata } from 'next';

import { NotFoundContent } from '@/components/NotFoundContent';
import { SiteDocument } from '@/components/SiteDocument';
import { rootMetadata, rootViewport } from '@/lib/root-metadata';
import { SITE_NAME } from '@/lib/seo';

/**
 * The 404 for URLs no route matches — bot probes like /wp-admin, and params a
 * route refuses with `dynamicParams = false`.
 *
 * With two root layouts ((site) and [locale]) there is no single layout left to
 * wrap an unmatched URL, so Next.js renders this file instead, as a complete
 * document. Without it those 404s fall back to Next's unstyled default page.
 * Enabled by `experimental.globalNotFound` in next.config.ts.
 */
export const metadata: Metadata = {
    ...rootMetadata,
    // The previous 404 inherited the homepage's title and its "index, follow",
    // contradicted by the "noindex" Next adds to every 404. Say what it is.
    title: `Page not found | ${SITE_NAME}`,
    robots: { index: false, follow: true },
};

export const viewport = rootViewport;

export default function GlobalNotFound() {
    return (
        <SiteDocument lang="en">
            <NotFoundContent />
        </SiteDocument>
    );
}
