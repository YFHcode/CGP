import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';

import '@/app/globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { organizationSchema, websiteSchema } from '@/lib/seo';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-5HH5Z24L';

/**
 * The whole HTML document around a page: fonts, tag manager, site-wide
 * structured data, header, footer and analytics.
 *
 * Shared by every root layout and by the global not-found page, which is what
 * lets the translated pages have their own root layout — and so their own
 * <html lang> — without becoming a second, drifting copy of the site shell.
 *
 * `lang` is the language of the page's content. `chromeLang` is the language of
 * the header and footer, which are English everywhere: on a German page the
 * document is German and the navigation is marked as English, so screen
 * readers pronounce each part correctly and nothing claims the whole page is in
 * a language it is not.
 */
export function SiteDocument({
    lang,
    chromeLang,
    children,
}: {
    lang: string;
    chromeLang?: string;
    children: React.ReactNode;
}) {
    return (
        <html lang={lang} className="dark">
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
                    <Header lang={chromeLang} />
                    <main id="main" className="flex-1">
                        {children}
                    </main>
                    <Footer lang={chromeLang} />
                </CurrencyProvider>

                <Analytics />
            </body>
        </html>
    );
}
