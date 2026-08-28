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
import {
    GRAMS_PER_OZ,
    SILVER_FINENESSES,
    SILVER_PURITY,
    SILVER_FINENESS_LABELS,
    type SilverFineness,
} from '@/lib/conversions';
import { periodFaqSchema } from '@/lib/period-faq';

/**
 * Silver per-unit pages.
 *
 * Deliberately not a copy of the gold template with the metal swapped: silver
 * purity is stamped as fineness (.925, .999), not karat, so the breakdown
 * table, the copy and the questions are genuinely different. That also makes
 * this the page that answers "what is my sterling silver worth", which the
 * karat-based gold pages never could.
 */

export const revalidate = 10800;

/**
 * Serve only the slugs generateStaticParams returns; anything else 404s at the
 * routing layer.
 *
 * Without this, an unknown slug renders on demand and notFound() returns the
 * not-found *body* with a 200 status — a soft 404, which Google reports in
 * Search Console and spends crawl budget on. The valid set here is closed and
 * fully known (the weight units we support), so nothing legitimate is lost.
 */
export const dynamicParams = false;

export function generateStaticParams() {
    return UNIT_PAGES.map((page) => ({ unit: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ unit: string }> }) {
    const { unit } = await params;
    const config = findUnitPage(unit);
    if (!config) {
        return pageMetadata({
            title: 'Unit not found',
            description: 'No silver price page exists for this unit.',
            path: `/silver-price-per/${unit}`,
            noIndex: true,
        });
    }

    const { silver } = await getPrices();
    const price = silver ? (silver.price / GRAMS_PER_OZ) * config.grams : null;
    const priceText = price ? ` — ${formatCurrency(price, 'USD')}` : '';

    return pageMetadata({
        title: `Silver Price ${config.heading} Today${priceText}`,
        description:
            `The current silver price per ${config.unit} in USD, with sterling (.925), fine (.999) ` +
            `and coin-silver values for ${config.audience}. Updated from live spot prices.`,
        path: `/silver-price-per/${config.slug}`,
        keywords: [
            `silver price per ${config.unit}`,
            `silver rate per ${config.unit}`,
            `sterling silver price per ${config.unit}`,
            `925 silver price per ${config.unit}`,
            `how much is a ${config.unit} of silver`,
        ],
    });
}

export default async function SilverPricePerUnitPage({
    params,
}: {
    params: Promise<{ unit: string }>;
}) {
    const { unit } = await params;
    const config = findUnitPage(unit);
    if (!config) notFound();

    const { silver, updatedAt } = await getPrices();
    if (!silver) notFound();

    const perGram = silver.price / GRAMS_PER_OZ;
    const price = perGram * config.grams;
    const money = (v: number) => formatCurrency(v, 'USD');

    const questions = [
        {
            question: `How much is silver per ${config.unit} today?`,
            answer:
                `One ${config.unit} of fine silver is worth about ${money(price * SILVER_PURITY['999'])} ` +
                `at the current spot price of ${money(silver.price)} per troy ounce.`,
        },
        {
            question: `What is sterling silver worth per ${config.unit}?`,
            answer:
                `Sterling is 92.5% silver, so one ${config.unit} of .925 sterling holds about ` +
                `${money(price * SILVER_PURITY['925'])} of silver at the current spot price. That is ` +
                `the melt value of the metal only — refiners and scrap buyers typically pay 80–95% ` +
                `of melt, and antique or designer pieces can be worth considerably more intact than ` +
                `melted.`,
        },
        {
            question: `How is the silver price per ${config.unit} calculated?`,
            answer:
                `Silver purity is stamped as fineness, not karat: .999 is fine silver, .958 is ` +
                `Britannia standard, .925 is sterling, .900 is coin silver (pre-1965 US dimes and ` +
                `quarters) and .800 is a common continental European standard. The table above starts ` +
                `from the pure spot price per ${config.unit} and multiplies by each fineness to get ` +
                `its melt value — there is no premium or discount beyond that percentage.`,
        },
    ];

    const trail = [
        { name: `Silver price per ${config.unit}`, href: `/silver-price-per/${config.slug}` },
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
                        Silver Price {config.heading} Today
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        Fine silver is worth{' '}
                        <strong className="text-white">{money(price * SILVER_PURITY['999'])}</strong> per{' '}
                        {config.unit}, and sterling (.925){' '}
                        <strong className="text-white">{money(price * SILVER_PURITY['925'])}</strong>.{' '}
                        {config.intro}
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
                        Silver price per {config.unit} by purity
                    </h2>
                    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900">
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Purity</th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Silver content</th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Value per {config.unit}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {SILVER_FINENESSES.map((fineness: SilverFineness) => (
                                    <tr key={fineness} className="border-b border-white/5">
                                        <td className="px-4 py-2 font-medium text-zinc-100">
                                            {SILVER_FINENESS_LABELS[fineness]}
                                        </td>
                                        <td className="px-4 py-2">
                                            {(SILVER_PURITY[fineness] * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-2">
                                            {money(price * SILVER_PURITY[fineness])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400">
                        Melt value only, before dealer margins. Most jewellery and flatware is stamped
                        925; pre-1965 US dimes, quarters and half dollars are 900. Other units:{' '}
                        {UNIT_PAGES.filter((p) => p.slug !== config.slug).map((p, i, arr) => (
                            <span key={p.slug}>
                                <Link
                                    href={`/silver-price-per/${p.slug}`}
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
                        Silver per {config.unit}: common questions
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
                links={relatedLinks(
                    'silverCalculator',
                    'silverToday',
                    'silverArchive',
                    'silverChart',
                    'silverInsights',
                    'ratio'
                )}
            />
        </>
    );
}
