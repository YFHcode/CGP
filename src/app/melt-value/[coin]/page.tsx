import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { CurrencyValue } from '@/components/CurrencyValue';
import { getPrices } from '@/lib/prices';
import {
    COINS,
    findCoin,
    pureGrams,
    pureTroyOz,
    meltValue,
    formatFineness,
    formatPurityPercent,
} from '@/lib/coins';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { formatCurrency } from '@/lib/currencies';
import { periodFaqSchema } from '@/lib/period-faq';

/**
 * Per-coin melt value pages.
 *
 * "silver quarter value", "krugerrand price today" and "gold sovereign value"
 * are large recurring searches that no page here answered — coins were
 * previously only mentioned in passing inside the per-unit prose.
 *
 * Melt value is deliberately framed as the metal floor, not the coin's worth:
 * a key-date coin can be worth many multiples of its silver, and saying
 * otherwise would cost someone real money.
 */

export const revalidate = 10800;

export const dynamicParams = false;

export function generateStaticParams() {
    return COINS.map((coin) => ({ coin: coin.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ coin: string }> }) {
    const { coin: slug } = await params;
    const coin = findCoin(slug);
    if (!coin) {
        return pageMetadata({
            title: 'Coin not found',
            description: 'No melt value page exists for this coin.',
            path: `/melt-value/${slug}`,
            noIndex: true,
        });
    }

    const { gold, silver } = await getPrices();
    const spot = coin.metal === 'gold' ? gold?.price : silver?.price;
    const value = spot ? meltValue(coin, spot) : null;
    const priceText = value ? ` — ${formatCurrency(value, 'USD')}` : '';

    return pageMetadata({
        title: `${coin.name} Melt Value${priceText}`,
        description:
            `The current melt value of a ${coin.name}, based on its ${pureGrams(coin).toFixed(3)} g ` +
            `of pure ${coin.metal} and live spot prices. Weight, fineness and how to tell it apart ` +
            `from lookalikes.`,
        path: `/melt-value/${coin.slug}`,
        keywords: [
            `${coin.name} melt value`,
            `${coin.name} value`,
            `${coin.name} silver content`,
            `how much is a ${coin.name} worth`,
            `${coin.name} price today`,
        ],
    });
}

export default async function CoinMeltValuePage({
    params,
}: {
    params: Promise<{ coin: string }>;
}) {
    const { coin: slug } = await params;
    const coin = findCoin(slug);
    if (!coin) notFound();

    const { gold, silver, updatedAt } = await getPrices();
    const quote = coin.metal === 'gold' ? gold : silver;
    if (!quote) notFound();

    const value = meltValue(coin, quote.price);
    const grams = pureGrams(coin);
    const troyOz = pureTroyOz(coin);
    const money = (v: number) => formatCurrency(v, 'USD');

    const questions = [
        {
            question: `What is a ${coin.name} worth today?`,
            answer:
                `Its melt value is about ${money(value)}, based on ${troyOz.toFixed(4)} troy ounces ` +
                `(${grams.toFixed(3)} g) of pure ${coin.metal} at a spot price of ` +
                `${money(quote.price)} per troy ounce. That is the metal content only — the coin ` +
                `may be worth considerably more to a collector.`,
        },
        {
            question: `How much ${coin.metal} is in a ${coin.name}?`,
            answer:
                `The coin weighs ${coin.grossGrams} g in total and is ` +
                `${formatPurityPercent(coin.fineness)} fine (${formatFineness(coin.fineness)}), so ` +
                `it contains ${grams.toFixed(3)} g of pure ${coin.metal} — ` +
                `${troyOz.toFixed(4)} troy ounces.`,
        },
        {
            question: `Is the melt value what a dealer will pay for a ${coin.name}?`,
            answer:
                'Not exactly. Melt value is the raw metal content at spot. Scrap buyers and ' +
                'refiners typically pay 80–95% of melt to cover refining and margin, while ' +
                'recognised bullion coins and collectable dates usually sell for more than melt, ' +
                'not less. Melt is best treated as the floor under a coin’s price.',
        },
    ];

    const trail = [
        { name: 'Coin melt values', href: '/melt-value' },
        { name: coin.name, href: `/melt-value/${coin.slug}` },
    ];

    const specs: [string, string][] = [
        ['Total weight', `${coin.grossGrams} g`],
        ['Fineness', `${formatFineness(coin.fineness)} (${formatPurityPercent(coin.fineness)})`],
        [`Pure ${coin.metal} content`, `${grams.toFixed(3)} g (${troyOz.toFixed(4)} ozt)`],
        ['Years struck', coin.years],
        ['Country', coin.country],
        ...(coin.faceValue ? ([['Face value', coin.faceValue]] as [string, string][]) : []),
    ];

    const sameCategory = COINS.filter(
        (other) => other.category === coin.category && other.slug !== coin.slug
    ).slice(0, 6);

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
                        {coin.name} Melt Value
                    </h1>
                    <p className="mb-4 text-3xl font-medium text-gold-300">
                        <CurrencyValue usd={value} format="money" />
                    </p>
                    <p className="max-w-3xl text-zinc-300">{coin.intro}</p>
                    <div className="mt-4">
                        <LastUpdated
                            updatedAt={updatedAt}
                            className="flex items-center gap-1.5 text-xs text-zinc-400"
                        />
                    </div>
                </div>
            </section>

            {coin.numismaticWarning && (
                <section className="bg-black py-6">
                    <div className="container mx-auto px-4">
                        <div className="mx-auto flex max-w-3xl gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                            <AlertTriangle
                                className="h-5 w-5 shrink-0 text-amber-400"
                                aria-hidden="true"
                            />
                            <div>
                                <h2 className="mb-1 font-semibold text-amber-200">
                                    Check the date before you sell
                                </h2>
                                <p className="text-sm text-zinc-300">{coin.numismaticWarning}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">Specifications</h2>
                    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <tbody className="text-zinc-300">
                                {specs.map(([label, detail]) => (
                                    <tr key={label} className="border-b border-white/5 last:border-0">
                                        <th
                                            scope="row"
                                            className="w-1/2 px-4 py-3 font-medium text-zinc-100"
                                        >
                                            {label}
                                        </th>
                                        <td className="px-4 py-3">{detail}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mx-auto mt-6 max-w-2xl text-zinc-300">{coin.context}</p>
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        {coin.name}: common questions
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

            {sameCategory.length > 0 && (
                <section className="bg-black py-10">
                    <div className="container mx-auto px-4">
                        <h2 className="mb-4 text-xl font-bold text-white">Other coins like this</h2>
                        <ul className="flex flex-wrap gap-3">
                            {sameCategory.map((other) => (
                                <li key={other.slug}>
                                    <Link
                                        href={`/melt-value/${other.slug}`}
                                        className="inline-block rounded-lg border border-white/10 px-4 py-2 text-sm text-gold-400 hover:border-gold-500/30 hover:text-gold-300"
                                    >
                                        {other.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-6 text-sm text-zinc-400">
                            Counting a mixed jar?{' '}
                            <Link href="/melt-value" className="text-gold-400 hover:text-gold-300">
                                Use the junk silver calculator
                            </Link>
                            .
                        </p>
                    </div>
                </section>
            )}

            <RelatedLinks
                links={
                    coin.metal === 'gold'
                        ? relatedLinks('calculator', 'goldToday', 'goldChart', 'goldArchive', 'ratio')
                        : relatedLinks(
                              'silverCalculator',
                              'silverToday',
                              'silverChart',
                              'silverArchive',
                              'ratio'
                          )
                }
            />
        </>
    );
}
