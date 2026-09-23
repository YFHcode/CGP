import { SiteDocument } from '@/components/SiteDocument';
import { findLocalePage } from '@/lib/locale-pages';
import { rootMetadata, rootViewport } from '@/lib/root-metadata';

export const metadata = rootMetadata;
export const viewport = rootViewport;

/**
 * Root layout for the translated pages (/de, /nl, /ua).
 *
 * These used to sit under the site-wide layout, which renders <html lang="en">
 * — so a German page declared itself English. Google detects language from the
 * text and was not misled, but Bing reads the declaration as its language
 * signal, and hreflang said "de" while the page said "en". The root layout is
 * the only place Next.js renders <html>, so these pages get their own.
 *
 * The header and footer stay English on these pages and are marked as such.
 */
export default async function LocaleLayout({
    children,
    params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
    const { locale } = await params;
    const lang = findLocalePage(locale)?.lang ?? 'en';
    return (
        <SiteDocument lang={lang} chromeLang={lang === 'en' ? undefined : 'en'}>
            {children}
        </SiteDocument>
    );
}
