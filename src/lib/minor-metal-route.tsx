import type { Metadata } from 'next';
import Link from 'next/link';

import { LazyPriceChart } from '@/components/LazyPriceChart';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LastUpdated } from '@/components/LastUpdated';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getMinorMetal, getPrices } from '@/lib/prices';
import { GRAMS_PER_OZ } from '@/lib/conversions';
import { breadcrumbSchema, datasetSchema, pageMetadata } from '@/lib/seo';
import { periodFaqSchema } from '@/lib/period-faq';
import { describeCoverage } from '@/lib/coverage';
import type { MinorMetal } from '@/lib/minor-metals';

/**
 * Shared renderer for the platinum and palladium pages.
 *
 * A shared function behind two explicit routes rather than one dynamic
 * segment: the app root already has a [locale] catch-all, and Next allows only
 * one dynamic slug per level. Explicit routes are the better answer anyway —
 * they cannot match an arbitrary bot-probe URL, which is the exact problem the
 * [locale] route had to be fixed for. Same pattern as period-route and
 * insights-route.
 *
 * These are current-price and chart pages only. There is deliberately no
 * day-by-day archive for these metals: the archive template is where the
 * thin-page risk lives, and minting another ~1,500 near-identical URLs for
 * metals that have not yet earned a single impression is the failure mode to
 * avoid. Once these pages show demand, the archive is a small step from here.
 */


export async function minorMetalMetadata(metal: MinorMetal): Promise<Metadata> {
    const { quote } = await getMinorMetal(metal.symbol);
    const price = quote?.price;

    // The live figure in the title is what makes these compete for
    // "platinum price today" against pages that only say the words.
    const title =
        typeof price === 'number' && Number.isFinite(price)
            ? `${metal.name} Price Today: $${Math.round(price).toLocaleString('en-US')} per Ounce`
            : metal.title;

    return {
        ...pageMetadata({
            title: metal.title,
            description: metal.description,
            path: `/${metal.slug}`,
            keywords: metal.keywords,
        }),
        title: { absolute: title },
    };
}

export async function MinorMetalPage({ metal }: { metal: MinorMetal }) {
    const [{ quote, series, source, updatedAt }, { gold }] = await Promise.all([
        getMinorMetal(metal.symbol),
        getPrices(),
    ]);

    const price = quote?.price ?? null;
    const perGram = price === null ? null : price / GRAMS_PER_OZ;
    const facts = describeCoverage(series);

    // The ratio against gold is the number that gives these pages a reason to
    // exist beyond the raw quote, and it is genuinely different per metal:
    // platinum below gold is the historical anomaly, palladium below gold is
    // the recent collapse.
    const goldPrice = gold?.price ?? null;
    const ratio =
        price !== null && goldPrice !== null && price > 0 ? goldPrice / price : null;

    const trail = [{ name: `${metal.name} price`, href: `/${metal.slug}` }];

    const money = (value: number) =>
        value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    periodFaqSchema(metal.faq),
                    ...(series.length > 0
                        ? [
                              datasetSchema({
                                  name: `${metal.name} price history`,
                                  description: facts
                                      ? `${metal.name} closing prices in USD per troy ounce — ${facts.sentence}.`
                                      : `${metal.name} closing prices in USD per troy ounce.`,
                                  path: `/${metal.slug}`,
                                  keywords: [
                                      `${metal.lower} price`,
                                      `${metal.lower} price history`,
                                      'precious metals data',
                                  ],
                                  variableMeasured: `${metal.name} price (USD per troy ounce)`,
                                  temporalCoverage: facts ? `${facts.start}/${facts.end}` : null,
                              }),
                          ]
                        : []),
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-12">
                <div className="container mx-auto px-4">
                    <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
                        {metal.name} Price Today
                    </h1>

                    {price !== null ? (
                        <div className="mb-6 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                            <span className="text-4xl font-bold text-white">{money(price)}</span>
                            <span className="text-zinc-400">per troy ounce</span>
                            {perGram !== null && (
                                <span className="text-zinc-300">
                                    {money(perGram)} per gram
                                </span>
                            )}
                        </div>
                    ) : (
                        <p className="mb-6 text-zinc-400">
                            The {metal.lower} price is temporarily unavailable. It reappears
                            automatically once the next scheduled update succeeds.
                        </p>
                    )}

                    <p className="max-w-3xl text-zinc-300">{metal.intro}</p>

                    <div className="mt-4">
                        <LastUpdated updatedAt={updatedAt} />
                    </div>
                </div>
            </section>

            {series.length > 1 && (
                <LazyPriceChart
                    lockMetal
                    metal={metal.chartMetal}
                    series={series}
                    source={source}
                    title={`${metal.name} closing prices`}
                />
            )}

            <section className="bg-black py-12">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        What moves the {metal.lower} price
                    </h2>
                    <div className="grid gap-6 md:grid-cols-3">
                        {metal.demand.map(({ label, body }) => (
                            <article
                                key={label}
                                className="rounded-lg border border-white/10 p-6"
                            >
                                <h3 className="mb-3 text-lg font-semibold text-gold-400">
                                    {label}
                                </h3>
                                <p className="text-sm text-zinc-300">{body}</p>
                            </article>
                        ))}
                    </div>

                    {ratio !== null && (
                        <p className="mt-8 max-w-3xl text-sm text-zinc-300">
                            One ounce of gold is currently worth about{' '}
                            <strong className="text-white">{ratio.toFixed(2)}</strong> ounces of{' '}
                            {metal.lower}
                            {/* No whitespace between the metal name and the
                                clause below, or JSX renders "platinum , so". */}
                            {ratio > 1
                                ? `, so ${metal.lower} trades below gold — read alongside the demand picture above rather than as a valuation on its own.`
                                : `, so ${metal.lower} still trades above gold.`}
                        </p>
                    )}
                </div>
            </section>

            {price !== null && (
                <section className="bg-zinc-900/30 py-12">
                    <div className="container mx-auto px-4">
                        <h2 className="mb-2 text-2xl font-bold text-white">
                            {metal.name} value by fineness
                        </h2>
                        <p className="mb-6 max-w-3xl text-sm text-zinc-400">
                            {metal.name} is not measured in karats. Pieces are marked by fineness
                            instead — the parts per thousand of pure metal — so the value below is
                            the spot price scaled by that purity, before any dealer margin.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[30rem] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th scope="col" className="px-4 py-3 text-white">
                                            Mark
                                        </th>
                                        <th scope="col" className="px-4 py-3 text-white">
                                            Purity
                                        </th>
                                        <th scope="col" className="px-4 py-3 text-white">
                                            Per gram
                                        </th>
                                        <th scope="col" className="px-4 py-3 text-white">
                                            Typically used for
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-zinc-300">
                                    {metal.purities.map(({ mark, purity, note }) => (
                                        <tr key={mark} className="border-b border-white/5">
                                            <td className="px-4 py-3 font-mono text-zinc-100">
                                                {mark}
                                            </td>
                                            <td className="px-4 py-3">
                                                {(purity * 100).toFixed(1)}%
                                            </td>
                                            <td className="px-4 py-3 font-medium text-white">
                                                {money((perGram ?? 0) * purity)}
                                            </td>
                                            <td className="px-4 py-3 text-zinc-400">{note}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            <section className="bg-black py-12">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        {metal.name} price: common questions
                    </h2>
                    <div className="mx-auto max-w-4xl divide-y divide-white/5">
                        {metal.faq.map((entry) => (
                            <div key={entry.question} className="py-5">
                                <h3 className="mb-2 text-lg font-semibold text-white">
                                    {entry.question}
                                </h3>
                                <p className="text-zinc-300">{entry.answer}</p>
                            </div>
                        ))}
                    </div>

                    <p className="mx-auto mt-8 max-w-4xl text-sm text-zinc-400">
                        Prices are indicative reference figures, may be delayed, and are not
                        trading quotes or financial advice. Compare with{' '}
                        <Link href="/gold-price-today" className="text-gold-400 hover:text-gold-300">
                            gold
                        </Link>{' '}
                        and{' '}
                        <Link
                            href="/silver-price-today"
                            className="text-gold-400 hover:text-gold-300"
                        >
                            silver
                        </Link>
                        .
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks('goldToday', 'silverToday', 'ratio', 'calculator', 'history')}
            />
        </>
    );
}
