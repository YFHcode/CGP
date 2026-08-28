import Link from 'next/link';
import { Landmark } from 'lucide-react';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { CurrencyValue } from '@/components/CurrencyValue';
import { getPrices, getRates } from '@/lib/prices';
import { GRAMS_PER_OZ, GOLD_HALLMARKS, GOLD_HALLMARK_PURITY, GOLD_HALLMARK_LABELS } from '@/lib/conversions';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { regionalEnglishAlternates } from '@/lib/locale-pages';
import { formatCurrency } from '@/lib/currencies';
import { periodFaqSchema } from '@/lib/period-faq';

/**
 * British gold price page — English-language, GBP-first, hallmark-based.
 *
 * This is deliberately not part of the [locale] system alongside /nl, /ua and
 * /de: those are translated counterparts of an English page. This page IS
 * the English content, targeted at a specific market — closer in spirit to
 * the currency and per-unit pages than to a translation.
 *
 * It exists because /uk was previously claimed by the Ukrainian locale page,
 * which is a genuine collision: "gold price uk" and "gold price per gram
 * uk" are large, high-RPM searches with unambiguous British intent, and
 * serving them Ukrainian-language content answered nothing. The Ukrainian
 * page moved to the unambiguous /ua; this took the now-free /uk.
 *
 * The other reason it earns its own page rather than reusing the karat
 * calculator: UK jewellery is hallmarked with a millesimal fineness number
 * (375, 585, 750, 916, 999), not a karat figure, under the Hallmarking Act
 * 1973. "What is 916 gold worth" and "9 carat gold price" are the same
 * question in two vocabularies this site didn't previously speak.
 */

export const revalidate = 10800;

export async function generateMetadata() {
    const [{ gold }, rates] = await Promise.all([getPrices(), getRates()]);
    const gbpRate = rates.rates.GBP;
    const gbpPerGram =
        gold && typeof gbpRate === 'number' && Number.isFinite(gbpRate) && gbpRate > 0
            ? (gold.price * gbpRate) / GRAMS_PER_OZ
            : null;
    const priceText = gbpPerGram !== null ? ` — £${gbpPerGram.toFixed(2)}/g` : '';

    const base = pageMetadata({
        title: `Gold Price UK Today${priceText}`,
        description:
            'UK gold price per gram and troy ounce in pounds, with a hallmark purity table — ' +
            '375 (9ct), 585 (14ct), 750 (18ct), 916 (22ct) and 999 fine.',
        path: '/uk',
        keywords: [
            'gold price uk',
            'gold price per gram uk',
            'gold price today uk',
            '9ct gold price uk',
            '18ct gold price uk',
            '22ct gold price uk',
            'uk gold hallmark',
        ],
    });

    // Declares /uk as the en-GB counterpart of /gold-price-today, so Google
    // routes British searchers here and everyone else there, instead of the
    // two competing for the same query.
    return {
        ...base,
        alternates: { ...base.alternates, languages: regionalEnglishAlternates() },
    };
}

export default async function UkGoldPricePage() {
    const [{ gold, updatedAt }, rates] = await Promise.all([getPrices(), getRates()]);
    if (!gold) {
        return null;
    }

    const gbpRate = rates.rates.GBP;
    const hasGbp = typeof gbpRate === 'number' && Number.isFinite(gbpRate) && gbpRate > 0;

    // FAQ/JSON-LD text is fixed at render time rather than reactive to the
    // currency selector, matching this site's convention elsewhere (silver
    // per-unit, coin melt value). Unlike those pages it is fixed in GBP, not
    // USD: the entire point of a "gold price UK" page is the sterling
    // figure, so quoting the structured answer in dollars would undercut
    // the page it's on. Falls back to USD only in the unlikely event the
    // GBP rate is temporarily unavailable, so the page never states a wrong
    // number labelled as GBP.
    const faqCurrency = hasGbp ? 'GBP' : 'USD';
    const perOz = hasGbp ? gold.price * gbpRate : gold.price;
    const perGram = perOz / GRAMS_PER_OZ;
    const money = (v: number) => formatCurrency(v, faqCurrency);

    const questions = [
        {
            question: 'What is the gold price in the UK today?',
            answer:
                `The UK gold price is currently about ${money(perOz)} per troy ounce, or ` +
                `${money(perGram)} per gram, for pure (999) gold. That is the international spot ` +
                `price converted to sterling — there is no separate UK market rate.`,
        },
        {
            question: 'What does the 916 hallmark mean?',
            answer:
                '916 is the millesimal fineness mark for 22 carat gold — 91.6% pure. It is the ' +
                'purity most UK wedding rings and gold sovereigns are made from, and one of the ' +
                'five standards recognised under the UK Hallmarking Act 1973 alongside 375, 585, ' +
                '750 and 999.',
        },
        {
            question: 'How much is 9 carat gold worth per gram?',
            answer:
                `9 carat gold is hallmarked 375, meaning 37.5% pure. At the current price, that is ` +
                `about ${money(perGram * GOLD_HALLMARK_PURITY['375'])} per gram of melt value — the ` +
                `metal content only, before any dealer margin. 9 carat is the most common standard ` +
                `for everyday British jewellery.`,
        },
        {
            question: 'Is the UK gold price different from the international gold price?',
            answer:
                'No. Gold trades on one international market, priced in US dollars per troy ounce ' +
                'and set daily via the LBMA Gold Price auction in London. A UK price is simply that ' +
                'same figure converted to sterling at the current exchange rate. High-street ' +
                'jewellers and dealers then add their own margin on top.',
        },
        {
            question: 'What is the difference between a UK hallmark and a karat?',
            answer:
                'They measure the same thing in different notation. A karat is a fraction of 24 ' +
                '(18 karat = 18/24 = 75% pure); a UK hallmark is that same purity written as parts ' +
                'per thousand, stamped by one of the four British Assay Offices. 9ct = 375, ' +
                '14ct = 585, 18ct = 750, 22ct = 916, 24ct = 999. British jewellery is legally ' +
                'required to carry the hallmark; the karat name is just how people talk about it.',
        },
    ];

    const trail = [{ name: 'Gold price UK', href: '/uk' }];

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
                    <div className="mb-3 flex items-center gap-3">
                        <Landmark className="h-8 w-8 text-gold-400" aria-hidden="true" />
                        <h1 className="text-3xl font-bold text-white md:text-4xl">
                            Gold Price UK Today
                        </h1>
                    </div>
                    <p className="mb-4 text-2xl font-medium text-gold-300">
                        <CurrencyValue usd={gold.price} />
                        <span className="ml-2 text-sm text-zinc-400">/ oz</span>
                        <span className="ml-4">
                            <CurrencyValue usd={gold.price / GRAMS_PER_OZ} />
                        </span>
                        <span className="ml-2 text-sm text-zinc-400">/ g</span>
                    </p>
                    <p className="max-w-3xl text-zinc-300">
                        The current gold price in pounds sterling, with UK hallmark purity — 375,
                        585, 750, 916 and 999 — rather than the US karat system. Figures come from
                        our own recorded spot price series.
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
                        Gold price per gram by hallmark
                    </h2>
                    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-900">
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Hallmark
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Purity
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Price per gram
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {GOLD_HALLMARKS.map((hallmark) => (
                                    <tr key={hallmark} className="border-b border-white/5">
                                        <td className="px-4 py-2 font-medium text-zinc-100">
                                            {GOLD_HALLMARK_LABELS[hallmark]}
                                        </td>
                                        <td className="px-4 py-2">
                                            {(GOLD_HALLMARK_PURITY[hallmark] * 100).toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-2">
                                            <CurrencyValue
                                                usd={
                                                    (gold.price / GRAMS_PER_OZ) *
                                                    GOLD_HALLMARK_PURITY[hallmark]
                                                }
                                                format="money"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400">
                        Melt value only, before dealer margins. Want a total for a specific weight?
                        Use the{' '}
                        <Link href="/gold-price-calculator" className="text-gold-400 hover:text-gold-300">
                            gold value calculator
                        </Link>
                        .
                    </p>
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">
                        Understanding UK gold hallmarks
                    </h2>
                    <div className="mx-auto max-w-3xl space-y-4 text-zinc-300">
                        <p>
                            Since the Hallmarking Act 1973, gold items sold in the UK over a small
                            weight threshold must be independently tested and stamped by one of the
                            four British Assay Offices — London, Birmingham, Sheffield or Edinburgh —
                            with a fineness mark showing parts of pure gold per thousand rather than a
                            karat figure.
                        </p>
                        <p>
                            375 (9 carat) is the most common standard in everyday British jewellery,
                            chosen because it is the most affordable legal gold purity. 750 (18 carat)
                            and 916 (22 carat) carry a higher gold content and a correspondingly higher
                            price, with 22 carat traditionally used for wedding rings and for coins
                            such as the gold sovereign. 999 marks fine, near-pure bullion.
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        UK gold price: common questions
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
                    'goldInGbp',
                    'goldToday',
                    'goldChart',
                    'goldArchive',
                    'goldInsights'
                )}
            />
        </>
    );
}
