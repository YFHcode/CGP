import Link from 'next/link';
import { Coins } from 'lucide-react';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { CurrencyValue } from '@/components/CurrencyValue';
import { JunkSilverCalculator } from '@/components/JunkSilverCalculator';
import { getPrices } from '@/lib/prices';
import {
    COINS,
    CATEGORY_LABELS,
    coinsByCategory,
    pureTroyOz,
    meltValue,
    ASW_PER_DOLLAR_FACE_UNCIRCULATED,
    ASW_PER_DOLLAR_FACE_CIRCULATED,
    type CoinCategory,
} from '@/lib/coins';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { formatCurrency } from '@/lib/currencies';
import { periodFaqSchema } from '@/lib/period-faq';

/**
 * Coin melt value index, and the home of the junk silver calculator.
 *
 * The per-coin pages answer "what is one of these worth". This page answers
 * the question people actually arrive with — a jar of mixed coins, counted by
 * denomination.
 */

export const revalidate = 10800;

export const metadata = pageMetadata({
    title: 'Coin Melt Value Calculator — Junk Silver, Bullion and Sovereigns',
    description:
        'Live melt values for US silver coins, junk silver bags, and gold and silver bullion ' +
        'coins. Count a mixed jar of dimes, quarters and half dollars, or look up any single ' +
        'coin’s exact silver or gold content.',
    path: '/melt-value',
    keywords: [
        'junk silver calculator',
        'coin melt value',
        'silver coin calculator',
        'melt value calculator',
        '90 percent silver value',
        'silver quarter value',
    ],
});

const ORDER: CoinCategory[] = ['us-silver', 'silver-bullion', 'gold-bullion'];

export default async function MeltValueIndexPage() {
    const { gold, silver, updatedAt } = await getPrices();

    const spotFor = (metal: 'gold' | 'silver') =>
        metal === 'gold' ? gold?.price ?? null : silver?.price ?? null;

    const money = (v: number) => formatCurrency(v, 'USD');

    const faceUsd = silver ? ASW_PER_DOLLAR_FACE_CIRCULATED * silver.price : null;

    const questions = [
        {
            question: 'What is junk silver?',
            answer:
                '"Junk silver" is US dimes, quarters and half dollars dated 1964 or earlier, which ' +
                'are 90% silver. The name means only that the coins have no collector value beyond ' +
                'their metal — they are ordinary circulated coinage, not damaged or fake. They are ' +
                'bought and sold by face value rather than by weight.',
        },
        {
            question: 'How much silver is in a dollar of face value?',
            answer:
                `A dollar of face value in 90% silver coin — ten dimes, four quarters or two half ` +
                `dollars — contains 22.5 g of silver, or ${ASW_PER_DOLLAR_FACE_UNCIRCULATED.toFixed(
                    4
                )} troy ounces, by design. The trade prices circulated coin at ` +
                `${ASW_PER_DOLLAR_FACE_CIRCULATED} troy ounces instead, because decades in ` +
                `circulation wore roughly 1% of the metal away.` +
                (faceUsd ? ` At current spot that is about ${money(faceUsd)} per dollar of face.` : ''),
        },
        {
            question: 'Which US coins contain silver?',
            answer:
                'Dimes, quarters and half dollars dated 1964 or earlier are 90% silver. Kennedy ' +
                'half dollars from 1965 to 1970 are 40% silver. Jefferson nickels struck between ' +
                '1942 and 1945 with a large mintmark above Monticello are 35% silver. Everything ' +
                'else in general circulation since 1971 contains none.',
        },
        {
            question: 'Is melt value the same as what my coins are worth?',
            answer:
                'No. Melt value is the metal content at spot, and is best treated as a floor. ' +
                'Refiners and scrap buyers pay 80–95% of melt, while recognised bullion coins and ' +
                'key collector dates sell well above it. A 1916-D dime or an 1893-S Morgan is ' +
                'worth thousands regardless of the silver price, so check dates and mintmarks ' +
                'before selling anything for its metal.',
        },
    ];

    const trail = [{ name: 'Coin melt values', href: '/melt-value' }];

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    periodFaqSchema(questions),
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-12">
                <div className="container mx-auto px-4">
                    <div className="mb-6 flex items-center justify-center gap-3">
                        <Coins className="h-8 w-8 text-gold-400" aria-hidden="true" />
                        <h1 className="text-4xl font-bold text-white md:text-5xl">
                            Coin Melt Values
                        </h1>
                    </div>
                    <p className="mx-auto max-w-3xl text-center text-zinc-300">
                        What the metal in a coin is actually worth, at live spot prices. Count a
                        mixed jar of US silver below, or look up any single coin&apos;s exact
                        content.
                        {faceUsd && (
                            <>
                                {' '}
                                One dollar of face value in 90% silver is currently worth about{' '}
                                <strong className="text-white">
                                    <CurrencyValue usd={faceUsd} format="money" />
                                </strong>
                                .
                            </>
                        )}
                    </p>
                    <div className="mt-4 flex justify-center">
                        <LastUpdated
                            updatedAt={updatedAt}
                            className="flex items-center gap-1.5 text-xs text-zinc-400"
                        />
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-2xl">
                        <JunkSilverCalculator spotPerOz={silver?.price ?? null} />
                    </div>
                </div>
            </section>

            {ORDER.map((category) => {
                const coins = coinsByCategory(category);
                if (coins.length === 0) return null;

                return (
                    <section key={category} className="border-t border-white/5 bg-zinc-900/30 py-10">
                        <div className="container mx-auto px-4">
                            <h2 className="mb-6 text-2xl font-bold text-white">
                                {CATEGORY_LABELS[category]}
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[36rem] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th scope="col" className="px-4 py-3 font-semibold text-white">
                                                Coin
                                            </th>
                                            <th scope="col" className="px-4 py-3 font-semibold text-white">
                                                Years
                                            </th>
                                            <th scope="col" className="px-4 py-3 font-semibold text-white">
                                                Pure metal
                                            </th>
                                            <th scope="col" className="px-4 py-3 text-right font-semibold text-white">
                                                Melt value
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-zinc-300">
                                        {coins.map((coin) => {
                                            const spot = spotFor(coin.metal);
                                            return (
                                                <tr key={coin.slug} className="border-b border-white/5">
                                                    <td className="px-4 py-3">
                                                        <Link
                                                            href={`/melt-value/${coin.slug}`}
                                                            className="font-medium text-gold-400 hover:text-gold-300"
                                                        >
                                                            {coin.name}
                                                        </Link>
                                                    </td>
                                                    <td className="px-4 py-3 text-zinc-400">
                                                        {coin.years}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {pureTroyOz(coin).toFixed(4)} ozt
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-white">
                                                        {spot !== null ? (
                                                            <CurrencyValue usd={meltValue(coin, spot)} format="money" />
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                );
            })}

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">Common questions</h2>
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
                    <p className="mx-auto mt-8 max-w-4xl text-sm text-zinc-400">
                        Melt values are calculated from live spot prices and published mint
                        specifications. They are the metal content only, before dealer margins, and
                        are not an offer to buy or sell. {COINS.length} coins listed.
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    'silverCalculator',
                    'calculator',
                    'silverToday',
                    'goldToday',
                    'ratio',
                    'silverChart'
                )}
            />
        </>
    );
}
