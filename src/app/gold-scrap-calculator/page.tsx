import Link from 'next/link';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { ScrapGoldCalculator } from '@/components/ScrapGoldCalculator';
import { getPrices } from '@/lib/prices';
import { SCRAP_BUYERS, SCRAP_KARATS, SCRAP_KARAT_LABELS, SCRAP_KARAT_PURITY } from '@/lib/scrap-gold';
import { GRAMS_PER_OZ } from '@/lib/conversions';
import { breadcrumbSchema, pageMetadata, SITE_URL } from '@/lib/seo';
import { formatCurrency } from '@/lib/currencies';
import { periodFaqSchema } from '@/lib/period-faq';

/**
 * Scrap gold calculator.
 *
 * Deliberately separate from /gold-price-calculator, which answers "what is
 * the metal worth". This answers "what will a buyer pay me for it" — a
 * materially smaller number, and the one someone with a bag of broken chains
 * is actually asking. The gap between melt and offer is the content.
 *
 * It also serves an audience the price pages cannot: someone selling is not
 * helped by a spot chart, and Google cannot answer "what will I be offered
 * for 40 g of 14K" with an inline widget the way it answers "gold price
 * today".
 */

export const revalidate = 10800;

export const metadata = pageMetadata({
    title: 'Scrap Gold Calculator — What Buyers Pay',
    description:
        'What your scrap gold is worth, and what a refiner, jeweller, mail-in buyer or pawn ' +
        'shop is likely to offer. Melt value plus payout ranges from 9K to 24K.',
    path: '/gold-scrap-calculator',
    keywords: [
        'scrap gold calculator',
        'scrap gold prices',
        'what is my scrap gold worth',
        'gold scrap value calculator',
        'sell scrap gold',
        '14k scrap gold price',
    ],
});

export default async function GoldScrapCalculatorPage() {
    const { gold, updatedAt } = await getPrices();
    const spot = gold?.price ?? null;
    const perGram = spot ? spot / GRAMS_PER_OZ : null;
    const money = (v: number) => formatCurrency(v, 'USD');

    // Worked example used in both the visible FAQ and its JSON-LD: 10 g of
    // 14K, which is roughly a couple of broken chains — the commonest real
    // case someone arrives with.
    const example = perGram ? perGram * SCRAP_KARAT_PURITY['14K'] * 10 : null;

    const questions = [
        {
            question: 'How much is scrap gold worth per gram?',
            answer: perGram
                ? `Pure (24K) gold is worth about ${money(perGram)} per gram at the current spot ` +
                  `price. Scrap is rarely pure, so the figure that matters is the karat: 14K is ` +
                  `58.3% gold, worth about ${money(perGram * SCRAP_KARAT_PURITY['14K'])} per gram ` +
                  `of melt value, and 9K is 37.5%, worth about ` +
                  `${money(perGram * SCRAP_KARAT_PURITY['9K'])}. That is the metal value, before ` +
                  `any buyer's margin.`
                : 'Scrap gold is worth its karat purity multiplied by the pure gold price per gram. ' +
                  '14K is 58.3% gold and 9K is 37.5%, so they are worth that fraction of the pure ' +
                  'price for the same weight.',
        },
        {
            question: 'Will a gold buyer pay the melt value?',
            answer:
                'No. Melt value is the ceiling, not an offer. A refiner taking bulk lots typically ' +
                'pays 90–95% of melt, a local jeweller or coin shop 75–90%, a mail-in service ' +
                '50–75%, and a pawn shop 40–60%. The spread exists because every buyer between you ' +
                'and the refinery takes a margin, and because smaller lots cost more to process ' +
                'per gram.',
        },
        {
            question: 'How do I know what karat my gold is?',
            answer:
                'Look for a stamp, usually on a clasp, the inside of a ring band or the back of a ' +
                'pendant. US pieces are marked 10K, 14K or 18K. UK and European pieces carry a ' +
                'millesimal hallmark instead — 375 for 9 carat, 585 for 14 carat, 750 for 18 carat ' +
                'and 916 for 22 carat. An unmarked item is not necessarily fake, but any buyer will ' +
                'test it before quoting.',
        },
        {
            question: 'What is 10 grams of 14K gold worth?',
            answer: example
                ? `About ${money(example)} in melt value at the current gold price. A jeweller ` +
                  `would typically offer somewhere between ${money(example * 0.75)} and ` +
                  `${money(example * 0.9)} for it, and a mail-in buyer considerably less.`
                : '10 grams of 14K gold contains 5.83 grams of pure gold, so its melt value is ' +
                  '5.83 times the current per-gram gold price. A jeweller would typically offer ' +
                  '75–90% of that.',
        },
        {
            question: 'How can I get a better price for scrap gold?',
            answer:
                'Get more than one quote — the spread between buyers on the same lot is often 20 ' +
                'percentage points or more. Weigh and sort by karat yourself before going in, so ' +
                'you can check the offer against the melt value. Sell larger quantities in one lot ' +
                'where you can, since rates improve with weight. And check whether a piece is worth ' +
                'more intact: designer, antique and hallmarked collectable items regularly sell for ' +
                'well above their gold content.',
        },
    ];

    const trail = [{ name: 'Scrap gold calculator', href: '/gold-scrap-calculator' }];

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    periodFaqSchema(questions),
                    {
                        '@context': 'https://schema.org',
                        '@type': 'WebApplication',
                        name: 'Scrap Gold Calculator',
                        applicationCategory: 'FinanceApplication',
                        operatingSystem: 'Any',
                        url: `${SITE_URL}/gold-scrap-calculator`,
                        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                    },
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        Scrap Gold Calculator
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        What your scrap gold is actually worth, and what a buyer is likely to offer
                        for it. Melt value is the ceiling — the number that matters when you sell is
                        a percentage of it, and which percentage depends entirely on who you sell to.
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
                    <ScrapGoldCalculator spotPerOz={spot} />
                </div>
            </section>

            <section className="border-t border-white/5 bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-2 text-2xl font-bold text-white">
                        What each type of buyer pays
                    </h2>
                    <p className="mb-6 max-w-3xl text-sm text-zinc-400">
                        Typical ranges, not quotes. Rates improve with quantity and with a competing
                        offer, and the best-paying option is usually the least convenient one.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[32rem] text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Buyer
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Typical payout
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Trade-off
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {SCRAP_BUYERS.map((buyer) => (
                                    <tr key={buyer.id} className="border-b border-white/5">
                                        <td className="px-4 py-3 font-medium text-zinc-100">
                                            {buyer.label}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gold-300">
                                            {Math.round(buyer.low * 100)}–{Math.round(buyer.high * 100)}%
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400">{buyer.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">Scrap gold value by karat</h2>
                    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900">
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Karat / hallmark
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Pure gold
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Melt value per gram
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {SCRAP_KARATS.map((karat) => (
                                    <tr key={karat} className="border-b border-white/5">
                                        <td className="px-4 py-2 font-medium text-zinc-100">
                                            {SCRAP_KARAT_LABELS[karat]}
                                        </td>
                                        <td className="px-4 py-2">
                                            {(SCRAP_KARAT_PURITY[karat] * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-2">
                                            {perGram
                                                ? money(perGram * SCRAP_KARAT_PURITY[karat])
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400">
                        Melt value only, before any buyer&apos;s margin. Selling coins rather than
                        jewellery? Use the{' '}
                        <Link href="/melt-value" className="text-gold-400 hover:text-gold-300">
                            coin melt value calculator
                        </Link>{' '}
                        instead — recognised bullion and collectable dates sell well above scrap
                        rates.
                    </p>
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        Selling scrap gold: common questions
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
                    'calculator',
                    'meltValue',
                    'goldToday',
                    'perGram',
                    'goldUk',
                    'silverCalculator'
                )}
            />
        </>
    );
}
