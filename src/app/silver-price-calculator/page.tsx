import { GoldCalculator } from '@/components/GoldCalculator';
import { LastUpdated } from '@/components/LastUpdated';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { getPrices } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { periodFaqSchema } from '@/lib/period-faq';
import { formatCurrency } from '@/lib/currencies';
import { GRAMS_PER_OZ } from '@/lib/conversions';

export const revalidate = 10800;

export const metadata = pageMetadata({
    title: 'Silver Price Calculator — Value Silver by Weight',
    description:
        'Work out what your silver is worth by weight. Enter ounces, grams or kilograms and get the melt value at current spot prices, including sterling and coin silver.',
    path: '/silver-price-calculator',
    keywords: [
        'silver calculator',
        'silver value calculator',
        'scrap silver calculator',
        'sterling silver value',
        'what is my silver worth',
    ],
});

/** Common silver purities. Unlike gold, silver is quoted in fineness. */
const FINENESS = [
    { name: 'Fine silver (.999)', purity: 0.999, note: 'bullion bars and rounds' },
    { name: 'Britannia (.958)', purity: 0.958, note: 'UK Britannia coins and some flatware' },
    { name: 'Sterling (.925)', purity: 0.925, note: 'most jewellery, cutlery and hollowware' },
    { name: 'Coin silver (.900)', purity: 0.9, note: 'pre-1965 US dimes, quarters and half dollars' },
    { name: 'Continental (.800)', purity: 0.8, note: 'much European flatware' },
];

export default async function SilverCalculatorPage() {
    const { silver, updatedAt } = await getPrices();
    const perGram = silver ? silver.price / GRAMS_PER_OZ : null;
    const money = (v: number) => formatCurrency(v, 'USD');

    const questions = [
        {
            question: 'How do I work out what my silver is worth?',
            answer:
                'Weigh it, then multiply the weight by the silver price and by its purity. Sterling ' +
                'is 92.5% silver, so 100 g of sterling contains 92.5 g of pure silver. The ' +
                'calculator above does this for you.',
        },
        {
            question: 'How much is sterling silver worth per gram?',
            answer: perGram
                ? `At the current spot price of ${money(silver!.price)} per troy ounce, sterling ` +
                  `silver (.925) is worth about ${money(perGram * 0.925)} per gram, against ` +
                  `${money(perGram)} for fine silver.`
                : 'Sterling silver is 92.5% pure, so it is worth 92.5% of the fine silver price by weight.',
        },
        {
            question: 'Will a dealer pay the melt value?',
            answer:
                'No. Dealers pay a percentage of melt value to cover refining, assay and margin, ' +
                'and the percentage is usually lower for silver than gold because the value per ' +
                'gram is so much smaller. Antique or hallmarked pieces may be worth more than melt.',
        },
    ];

    const trail = [{ name: 'Silver price calculator', href: '/silver-price-calculator' }];

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    periodFaqSchema(questions),
                    {
                        '@context': 'https://schema.org',
                        '@type': 'WebApplication',
                        name: 'Silver Price Calculator',
                        applicationCategory: 'FinanceApplication',
                        operatingSystem: 'Any',
                        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                    },
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-center text-3xl font-bold text-white md:text-4xl">
                        Silver Price Calculator
                    </h1>
                    <p className="mx-auto max-w-3xl text-center text-zinc-300">
                        Find out what your silver is worth at current spot prices. Enter the weight
                        in ounces, grams or kilograms — then scale the result by purity using the
                        table below.
                    </p>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    {silver ? (
                        <>
                            <GoldCalculator goldPricePerOz={silver.price} metal="silver" />
                            <div className="mt-6">
                                <LastUpdated updatedAt={updatedAt} />
                            </div>
                        </>
                    ) : (
                        <p className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-zinc-900/50 p-6 text-center text-zinc-300">
                            The calculator needs a current silver price and we couldn&apos;t load one.
                            Please try again shortly.
                        </p>
                    )}
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">Silver purity by fineness</h2>
                    <p className="mb-6 max-w-3xl text-zinc-300">
                        Silver is measured in fineness rather than karat. Multiply the calculator
                        result by the purity below to get the melt value of a specific piece.
                    </p>
                    <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900">
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Fineness</th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Per gram</th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">Typically found in</th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {FINENESS.map((entry) => (
                                    <tr key={entry.name} className="border-b border-white/5">
                                        <td className="px-4 py-2 font-medium text-zinc-100">{entry.name}</td>
                                        <td className="px-4 py-2">
                                            {perGram ? money(perGram * entry.purity) : '—'}
                                        </td>
                                        <td className="px-4 py-2">{entry.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">Common questions</h2>
                    <div className="mx-auto max-w-4xl divide-y divide-white/5">
                        {questions.map((entry) => (
                            <div key={entry.question} className="py-5">
                                <h3 className="mb-2 text-lg font-semibold text-white">{entry.question}</h3>
                                <p className="text-zinc-300">{entry.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks('calculator', 'silverToday', 'silverArchive', 'goldToday', 'history', 'silverChart')}
            />
        </>
    );
}
