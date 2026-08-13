import { notFound } from 'next/navigation';
import Link from 'next/link';

import { LazyPriceChart } from '@/components/LazyPriceChart';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { getPrices, getHistory } from '@/lib/prices';
import { LOCALE_PAGES, findLocalePage } from '@/lib/locale-pages';
import { pageMetadata, SITE_URL } from '@/lib/seo';
import { periodFaqSchema } from '@/lib/period-faq';
import { formatCurrency } from '@/lib/currencies';
import { GRAMS_PER_OZ } from '@/lib/conversions';

/**
 * Localized landing pages at /nl, /uk, /de.
 *
 * Each is the counterpart of an English page and declares hreflang both ways,
 * so Google serves the right language rather than treating them as duplicates
 * competing with the English original.
 */

export const revalidate = 10800;

export function generateStaticParams() {
    return LOCALE_PAGES.map((page) => ({ locale: page.locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const config = findLocalePage(locale);
    if (!config) {
        return pageMetadata({
            title: 'Not found',
            description: 'No page exists at this address.',
            path: `/${locale}`,
            noIndex: true,
        });
    }

    const base = pageMetadata({
        title: config.title,
        description: config.description,
        path: `/${config.locale}`,
    });

    // hreflang: every localized page points at all the others and at the
    // English original, which is what tells Google these are alternates
    // rather than competing duplicates.
    return {
        ...base,
        alternates: {
            canonical: `${SITE_URL}/${config.locale}`,
            languages: {
                'x-default': `${SITE_URL}${config.canonicalEnglishPath}`,
                en: `${SITE_URL}${config.canonicalEnglishPath}`,
                ...Object.fromEntries(
                    LOCALE_PAGES.map((page) => [page.lang, `${SITE_URL}/${page.locale}`])
                ),
            },
        },
    };
}

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const config = findLocalePage(locale);
    if (!config) notFound();

    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);
    const isGold = config.metal === 'XAU';
    const quote = isGold ? gold : silver;
    if (!quote) notFound();

    const money = (v: number) => formatCurrency(v, 'USD');

    return (
        <div lang={config.lang}>
            <JsonLd schema={periodFaqSchema(config.faq)} />

            <section className="bg-zinc-900/50 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        {config.heading}
                    </h1>
                    <p className="mb-4 text-2xl font-medium text-gold-300">
                        {money(quote.price)}
                        <span className="ml-2 text-sm text-zinc-400">/ oz</span>
                        <span className="ml-4">{money(quote.price / GRAMS_PER_OZ)}</span>
                        <span className="ml-2 text-sm text-zinc-400">/ g</span>
                    </p>
                    <p className="max-w-3xl text-zinc-300">{config.intro}</p>
                    <div className="mt-4">
                        <LastUpdated
                            updatedAt={updatedAt}
                            className="flex items-center gap-1.5 text-xs text-zinc-400"
                        />
                    </div>
                </div>
            </section>

            <LazyPriceChart
                gold={history.gold}
                silver={history.silver}
                source={history.source}
                defaultMetal={isGold ? 'gold' : 'silver'}
                lockMetal
                title={config.chartTitle}
            />

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-4xl divide-y divide-white/5">
                        {config.faq.map((entry) => (
                            <div key={entry.question} className="py-5">
                                <h2 className="mb-2 text-lg font-semibold text-white">
                                    {entry.question}
                                </h2>
                                <p className="text-zinc-300">{entry.answer}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mx-auto mt-8 max-w-4xl border-t border-white/10 pt-6">
                        <Link
                            href={config.canonicalEnglishPath}
                            className="text-gold-400 hover:text-gold-300"
                        >
                            {config.englishLink} →
                        </Link>
                        <p className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-400">
                            {LOCALE_PAGES.filter((p) => p.locale !== config.locale).map((p) => (
                                <Link
                                    key={p.locale}
                                    href={`/${p.locale}`}
                                    hrefLang={p.lang}
                                    className="hover:text-gold-300"
                                >
                                    {p.heading}
                                </Link>
                            ))}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
