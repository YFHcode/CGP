import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { getPrices, getRates } from '@/lib/prices';
import { CURRENCY_PAGES, findCurrencyPage } from '@/lib/currency-pages';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { formatCurrency } from '@/lib/currencies';
import { GRAMS_PER_OZ, KARATS, KARAT_PURITY, type Karat } from '@/lib/conversions';
import { periodFaqSchema } from '@/lib/period-faq';

export const revalidate = 10800;

/**
 * Serve only the slugs generateStaticParams returns; anything else 404s at the
 * routing layer.
 *
 * Without this, an unknown slug renders on demand and notFound() returns the
 * not-found *body* with a 200 status — a soft 404, which Google reports in
 * Search Console and spends crawl budget on. The valid set here is closed and
 * fully known (the currencies we hold rates for), so nothing legitimate is
 * lost.
 */
export const dynamicParams = false;

export function generateStaticParams() {
    return CURRENCY_PAGES.map((page) => ({ currency: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ currency: string }> }) {
    const { currency } = await params;
    const config = findCurrencyPage(currency);

    if (!config) {
        return pageMetadata({
            title: 'Currency not found',
            description: 'No gold price page exists for this currency.',
            path: `/gold-price-in/${currency}`,
            noIndex: true,
        });
    }

    const { gold } = await getPrices();
    const { rates } = await getRates();
    const rate = rates[config.currency];
    const price = gold && rate ? gold.price * rate : null;

    const priceText = price
        ? `${formatCurrency(price, config.currency, { maximumFractionDigits: 0 })} per troy ounce`
        : 'live rates';

    return pageMetadata({
        title: `Gold Price in ${config.currency} Today — ${priceText}`,
        description:
            `Today's gold price in ${config.currency} for ${config.region}, per gram, ` +
            `${config.localUnits.map((u) => u.name).join(', ')} and troy ounce, with a karat breakdown.`,
        path: `/gold-price-in/${config.slug}`,
        keywords: [
            `gold price in ${config.currency.toLowerCase()}`,
            `gold rate ${config.region.toLowerCase()}`,
            `gold price per gram ${config.currency.toLowerCase()}`,
            `${config.adjective.toLowerCase()} gold price`,
        ],
    });
}

export default async function GoldPriceInCurrencyPage({
    params,
}: {
    params: Promise<{ currency: string }>;
}) {
    const { currency } = await params;
    const config = findCurrencyPage(currency);
    if (!config) notFound();

    const [{ gold, updatedAt }, { rates }] = await Promise.all([getPrices(), getRates()]);
    const rate = rates[config.currency];

    // Without a rate we would be publishing a page with no figures on it.
    if (!gold || !rate) notFound();

    const perOz = gold.price * rate;
    const perGram = perOz / GRAMS_PER_OZ;
    const money = (v: number) => formatCurrency(v, config.currency);

    const trail = [{ name: `Gold price in ${config.currency}`, href: `/gold-price-in/${config.slug}` }];

    const questions = [
        {
            question: `What is the gold price in ${config.currency} today?`,
            answer:
                `Gold is trading at about ${money(perOz)} per troy ounce and ${money(perGram)} ` +
                `per gram in ${config.currency}. This is the international spot price converted ` +
                `at the current exchange rate, before local duties, taxes or dealer margins.`,
        },
        ...config.localUnits.map((unit) => ({
            question: `How much is gold per ${unit.name} in ${config.currency}?`,
            answer:
                `One ${unit.name} of pure gold works out at about ` +
                `${money(perGram * unit.grams)} — ${unit.note}.`,
        })),
        {
            question: `How much is 22K and 18K gold per gram in ${config.currency}?`,
            answer:
                `Purity scales the price directly, so 22K is worth about ` +
                `${money(perGram * KARAT_PURITY['22K'])} per gram and 18K about ` +
                `${money(perGram * KARAT_PURITY['18K'])}, against ${money(perGram)} for pure 24K.`,
        },
    ];

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    periodFaqSchema(questions),
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        Gold Price in {config.currency} Today
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        Gold is trading at <strong className="text-white">{money(perOz)}</strong> per
                        troy ounce and <strong className="text-white">{money(perGram)}</strong> per
                        gram in {config.adjective} {config.currency === 'EUR' ? 'euros' : 'terms'}.
                        Figures are the international spot price converted at the current exchange
                        rate.
                    </p>
                    <div className="mt-4 flex justify-start">
                        <LastUpdated updatedAt={updatedAt} className="flex items-center gap-1.5 text-xs text-zinc-400" />
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
                            <h2 className="mb-4 text-xl font-bold text-white">
                                Gold price by weight in {config.currency}
                            </h2>
                            <dl className="space-y-2 text-sm">
                                <div className="flex justify-between gap-4">
                                    <dt className="text-zinc-400">Per troy ounce</dt>
                                    <dd className="font-medium text-zinc-100">{money(perOz)}</dd>
                                </div>
                                {config.localUnits.map((unit) => (
                                    <div key={unit.name} className="flex justify-between gap-4">
                                        <dt className="text-zinc-400">
                                            Per {unit.name}
                                            <span className="ml-2 text-xs text-zinc-500">
                                                {unit.grams} g
                                            </span>
                                        </dt>
                                        <dd className="font-medium text-zinc-100">
                                            {money(perGram * unit.grams)}
                                        </dd>
                                    </div>
                                ))}
                                <div className="flex justify-between gap-4 border-t border-white/5 pt-2">
                                    <dt className="text-zinc-400">Per kilogram</dt>
                                    <dd className="font-medium text-zinc-100">
                                        {money(perGram * 1000)}
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5">
                            <h2 className="mb-4 text-xl font-bold text-white">
                                Price per gram by karat
                            </h2>
                            <dl className="space-y-2 text-sm">
                                {KARATS.map((karat: Karat) => (
                                    <div key={karat} className="flex justify-between gap-4">
                                        <dt className="text-zinc-400">
                                            {karat}
                                            <span className="ml-2 text-xs text-zinc-500">
                                                {(KARAT_PURITY[karat] * 100).toFixed(1)}%
                                            </span>
                                            {config.commonKarats.includes(karat) && (
                                                <span className="ml-2 rounded bg-gold-500/10 px-1.5 py-0.5 text-[0.65rem] text-gold-300">
                                                    common in {config.region}
                                                </span>
                                            )}
                                        </dt>
                                        <dd className="font-medium text-zinc-100">
                                            {money(perGram * KARAT_PURITY[karat])}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">
                        Buying gold in {config.region}
                    </h2>
                    <p className="max-w-3xl text-zinc-300">{config.context}</p>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        Gold in {config.currency}: common questions
                    </h2>
                    <div className="mx-auto max-w-4xl divide-y divide-white/5">
                        {questions.map((entry) => (
                            <div key={entry.question} className="py-5">
                                <h3 className="mb-2 text-lg font-semibold text-white">
                                    {entry.question}
                                </h3>
                                <p className="text-zinc-300">{entry.answer}</p>
                            </div>
                        ))}
                    </div>
                    <p className="mx-auto mt-6 max-w-4xl text-sm text-zinc-400">
                        Prices convert the international spot price at the current {config.currency}
                        {' '}exchange rate. Local retail prices differ — see other currencies:{' '}
                        {CURRENCY_PAGES.filter((p) => p.slug !== config.slug).map((p, i, arr) => (
                            <span key={p.slug}>
                                <Link
                                    href={`/gold-price-in/${p.slug}`}
                                    className="text-gold-400 hover:text-gold-300"
                                >
                                    {p.currency}
                                </Link>
                                {i < arr.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                        .
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks('goldToday', 'calculator', 'goldArchive', 'silverToday', 'history', 'goldChart')}
            />
        </>
    );
}
