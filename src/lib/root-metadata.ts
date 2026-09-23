import type { Metadata, Viewport } from 'next';

import { SITE_NAME, SITE_URL } from '@/lib/seo';

/**
 * Metadata every root layout declares.
 *
 * The app has two root layouts — src/app/(site)/layout.tsx for the English
 * site and src/app/[locale]/layout.tsx for the translated pages — because the
 * root layout is the only place Next.js renders <html>, and each needs its own
 * `lang`. Both export this object, so the title template, robots defaults and
 * metadataBase cannot drift apart between them.
 */
export const rootMetadata: Metadata = {
    // `template` gives every page a branded suffix without repeating it.
    title: {
        default: `${SITE_NAME} — Gold & Silver Price Charts, Live Rates and Calculator`,
        template: `%s | ${SITE_NAME}`,
    },
    description:
        'Gold and silver spot prices in eight currencies, with historical charts, a karat-aware value calculator and market news.',
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(SITE_URL),
    // NOTE: no `alternates.canonical` here on purpose. Setting it in the root
    // layout made every page canonicalise to the homepage. Pages set their own
    // via pageMetadata() in src/lib/seo.ts.
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    // Google Search Console verification. Set NEXT_PUBLIC_GOOGLE_VERIFICATION to
    // enable — the old hardcoded 'your-google-verification-code' placeholder was
    // shipping to production.
    verification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
        ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION }
        : undefined,
};

export const rootViewport: Viewport = {
    themeColor: '#000000',
    colorScheme: 'dark',
};
