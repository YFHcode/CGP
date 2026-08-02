import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { organizationSchema, websiteSchema, SITE_NAME, SITE_URL } from '@/lib/seo';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-5HH5Z24L';

export const metadata: Metadata = {
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

export const viewport: Viewport = {
    themeColor: '#000000',
    colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className="dark">
            <body
                className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased`}
            >
                {/* NOTE: GA4 is configured inside the GTM container. Loading
                    gtag.js here as well double-counted every pageview. */}
                <Script id="google-tag-manager" strategy="afterInteractive">
                    {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
                </Script>

                <noscript>
                    <iframe
                        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                        height="0"
                        width="0"
                        style={{ display: 'none', visibility: 'hidden' }}
                        title="Google Tag Manager"
                    />
                </noscript>

                <JsonLd schema={[organizationSchema(), websiteSchema()]} />

                <CurrencyProvider>
                    <Header />
                    <main id="main" className="flex-1">
                        {children}
                    </main>
                    <Footer />
                </CurrencyProvider>

                <Analytics />
            </body>
        </html>
    );
}
