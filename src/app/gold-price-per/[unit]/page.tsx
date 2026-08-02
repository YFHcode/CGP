import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { getPrices } from '@/lib/prices';
import { UNIT_PAGES, findUnitPage } from '@/lib/unit-pages';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { formatCurrency } from '@/lib/currencies';
import { GRAMS_PER_OZ, KARATS, KARAT_PURITY, type Karat } from '@/lib/conversions';
import { periodFaqSchema } from '@/lib/period-faq';

export const revalidate = 10800;

export function generateStaticParams() {
    return UNIT_PAGES.map((page) => ({ unit: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ unit: string }> }) {
    const { unit } = await params;
    const config = findUnitPage(unit);
    if (!config) {
        return pageMetadata({
            title: 'Unit not found',
            description: 'No gold price page exists for this unit.',
            path: `/gold-price-per/${unit}`,
            noIndex: true,
        });
    }

    const { gold } = await getPrices();
    const price = gold ? (gold.price / GRAMS_PER_OZ) * config.grams : null;
    const priceText = price ? ` — ${formatCurrency(price, 'USD')}` : '';

    return pageMetadata({
        title: `Gold Price ${config.heading} Today${priceText}`,
        description:
            `The current gold price per ${config.unit} in USD, with a karat breakdown for ` +
            `${config.audience}. Updated from live spot prices.`,
        path: `/gold-price-per/${config.slug}`,
        keywords: [
            `gold price per ${config.unit}`,
            `gold rate per ${config.unit}`,
            `how much is a ${config.unit} of gold`,
            `24k gold price per ${config.unit}`,
        ],
    });
}

export default async function GoldPricePerUnitPage({
    params,
}: {
    params: Promise<{ unit: string }>;
}) {
    const { unit } = await params;
    const config = findUnitPage(unit);
    if (!config) notFound();

    const { gold, updatedAt } = await getPrices();
    if (!gold) notFound();

    const perGram = gold.price / GRAMS_PER_OZ;
    const price = perGram * config.grams;
    const money = (v: number) => formatCurrency(v, 'USD');

    const questions = [
        {
            question: `How much is gold per ${config.unit} today?`,
            answer:
                `One ${config.unit} of pure 24K gold is worth about ${money(price)} at the current ` +
                `spot price of ${money(gold.price)} per troy ounce.`,
        },
        {
            question: `How much is 18K and 14K gold per ${config.unit}?`,
            answer:
                `Value scales with purity, so 18K gold is worth about ` +
                `${money(price * KARAT_PURITY['18K'])} per ${config.unit} and 14K about ` +
                `${money(price * KARAT_PURITY['14K'])}, against ${money(price)} for pure 24K.`,
        },
        {
            question: `How is the gold price per ${config.unit} calculated?`,
            answer: config.context,
        },
    ];

    const trail = [{ name: `Gold price per ${config.unit}`, href: `/gold-price-per/${config.slug}` }];

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
                        Gold Price {config.heading} Today
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        Pure 24K gold is worth <strong className="text-white">{money(price)}</strong>{' '}
                        per {config.unit}. {config.intro}
                    </p>
                    <div className="mt-4">
                        <LastUpdated
                            updatedAt={updatedAt}
                            className="flex items-center gap-1.5 text-xs text-zinc-400"
                        />
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">
                        Gold price per {config.unit} by karat
                    </h2>
                    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900">
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Purity</th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Gold content</th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Value per {config.unit}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {KARATS.map((karat: Karat) => (
                                    <tr key={karat} className="border-b border-white/5">
                                        <td className="px-4 py-2 font-medium text-zinc-100">{karat}</td>
                                        <td className="px-4 py-2">
                                            {(KARAT_PURITY[karat] * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-2">
                                            {money(price * KARAT_PURITY[karat])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400">
                        Melt value only, before dealer margins. Other units:{' '}
                        {UNIT_PAGES.filter((p) => p.slug !== config.slug).map((p, i, arr) => (
                            <span key={p.slug}>
                                <Link
                                    href={`/gold-price-per/${p.slug}`}
                                    className="text-gold-400 hover:text-gold-300"
                                >
                                    per {p.unit}
                                </Link>
                                {i < arr.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                        .
                    </p>
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        Gold per {config.unit}: common questions
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
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks('calculator', 'goldToday', 'goldArchive', 'silverToday', 'history', 'goldChart')}
            />
        </>
    );
}
