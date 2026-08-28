import type { Metadata } from 'next';
import Link from 'next/link';

import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LastUpdated } from '@/components/LastUpdated';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { LazyForecastChart } from '@/components/LazyForecastChart';
import { getHistory } from '@/lib/prices';
import { forecast } from '@/lib/forecast';
import { backtest, describeSkill } from '@/lib/forecast-backtest';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { periodFaqSchema } from '@/lib/period-faq';
import { METAL_ROUTES } from '@/lib/history-periods';
import type { MetalSymbol } from '@/types';

/**
 * Seven-day forecast pages.
 *
 * "gold price forecast" and "gold price prediction" are high-volume queries
 * served almost entirely by pages that assert a number with no basis and no
 * accountability. The differentiator here is not a better model — no model
 * built on price history beats the random walk at this horizon — it is
 * publishing the measured track record next to the projection, so a reader can
 * see what it is worth instead of being asked to trust it.
 *
 * That means the page leads with the range and states the skill score plainly,
 * including when the honest answer is "no better than assuming no change".
 */

const HORIZON = 7;


function seriesFor(metal: MetalSymbol, history: Awaited<ReturnType<typeof getHistory>>) {
    return metal === 'XAU' ? history.gold : history.silver;
}

export async function forecastMetadata(metal: MetalSymbol): Promise<Metadata> {
    const route = METAL_ROUTES[metal];
    const lower = route.name.toLowerCase();

    return pageMetadata({
        title: `${route.name} Price Forecast — Next 7 Days`,
        description:
            `A seven-day ${lower} price projection with 80% and 95% ranges, plus the measured ` +
            `accuracy of that projection against a no-change benchmark. Updated daily. Not ` +
            `financial advice.`,
        path: `/${lower}-price-forecast`,
        keywords: [
            `${lower} price forecast`,
            `${lower} price prediction`,
            `${lower} price forecast next week`,
            `${lower} price 7 day forecast`,
            `will ${lower} go up`,
        ],
    });
}

export async function ForecastPage({ metal }: { metal: MetalSymbol }) {
    const route = METAL_ROUTES[metal];
    const lower = route.name.toLowerCase();
    const history = await getHistory();
    const series = seriesFor(metal, history);

    const result = forecast(series, HORIZON);
    const accuracy = backtest(series, HORIZON);
    const skillSentence = describeSkill(accuracy);

    const trail = [{ name: `${route.name} price forecast`, href: `/${lower}-price-forecast` }];
    const money = (v: number) =>
        v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    const anchorClose = result?.anchor.close ?? null;

    const questions = [
        {
            question: `What is the ${lower} price forecast for next week?`,
            answer: result
                ? `Starting from ${money(result.anchor.close)} on ${result.anchor.date}, the ` +
                  `central projection seven trading days out is ${money(result.points[HORIZON - 1].expected)}, ` +
                  `with an 80% range of ${money(result.points[HORIZON - 1].low80)} to ` +
                  `${money(result.points[HORIZON - 1].high80)}. The range is the meaningful part: ` +
                  `the central figure is close to the current price because that is what the data supports.`
                : `There is not enough recorded history yet to project ${lower} prices.`,
        },
        {
            question: `How accurate is this ${lower} forecast?`,
            answer: skillSentence,
        },
        {
            question: `Why is the forecast almost flat?`,
            answer:
                `Because a week-ahead metals price is close to a random walk. Fitting this model ` +
                `across an out-of-sample window found that every version with a trend component ` +
                `performed worse than one without — a trend line drawn across the next seven days ` +
                `would be inventing information the price series does not contain. What can be ` +
                `estimated honestly is how far the price is likely to travel, which is the shaded ` +
                `range.`,
        },
        {
            question: `Can I trade on this?`,
            answer:
                `No. This is a statistical projection from past closes, published for context ` +
                `rather than as a recommendation. It knows nothing about interest rates, central ` +
                `bank buying, geopolitics or anything else that actually moves ${lower}, and no ` +
                `part of this site is financial advice.`,
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
                        {route.name} Price Forecast: Next 7 Days
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        A statistical projection of where {lower} could trade over the next seven
                        trading sessions, shown as a range rather than a single number — and, below
                        it, how accurate that projection has actually been.
                    </p>
                    {result && (
                        <div className="mt-4">
                            <LastUpdated updatedAt={history.updatedAt} />
                        </div>
                    )}
                </div>
            </section>

            {result ? (
                <>
                    <section className="bg-black py-10">
                        <div className="container mx-auto px-4">
                            <LazyForecastChart
                                history={series}
                                forecast={result.points}
                                metalName={route.name}
                                color={metal === 'XAU' ? '#d6a93e' : '#94a3b8'}
                            />
                            <p className="mt-3 text-center text-xs text-zinc-500">
                                Shaded bands are the 80% and 95% ranges. The dashed line is the
                                central projection — the least reliable thing on this chart.
                            </p>
                        </div>
                    </section>

                    <section className="border-y border-white/5 bg-zinc-900/20 py-10">
                        <div className="container mx-auto px-4">
                            <h2 className="mb-4 text-2xl font-bold text-white">
                                How accurate has this been?
                            </h2>
                            <p className="mb-6 max-w-3xl text-zinc-300">{skillSentence}</p>

                            {accuracy && (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[38rem] text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-white/10 text-white">
                                                <th scope="col" className="px-3 py-3">Days ahead</th>
                                                <th scope="col" className="px-3 py-3">Model error</th>
                                                <th scope="col" className="px-3 py-3">No-change error</th>
                                                <th scope="col" className="px-3 py-3">Skill</th>
                                                <th scope="col" className="px-3 py-3">80% range held</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-zinc-300">
                                            {accuracy.horizons.map((h) => (
                                                <tr key={h.horizon} className="border-b border-white/5">
                                                    <td className="px-3 py-2">{h.horizon}</td>
                                                    <td className="px-3 py-2">{h.modelMape.toFixed(2)}%</td>
                                                    <td className="px-3 py-2">{h.naiveMape.toFixed(2)}%</td>
                                                    <td
                                                        className={
                                                            h.skillRatio < 1
                                                                ? 'px-3 py-2 text-green-300'
                                                                : 'px-3 py-2 text-amber-300'
                                                        }
                                                    >
                                                        {h.skillRatio.toFixed(3)}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {h.coverage80Pct.toFixed(0)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <p className="mt-4 max-w-3xl text-xs text-zinc-500">
                                Measured by walk-forward testing: the model is refitted at each of{' '}
                                {accuracy?.origins ?? 0} historical starting points using only the
                                data available then, and compared with what actually happened. Skill
                                below 1 means it beat the no-change benchmark. &ldquo;80% range
                                held&rdquo; is how often the real price landed inside the 80% band —
                                a figure above 80% means the band is wider than it strictly needs to
                                be.
                            </p>
                        </div>
                    </section>

                    <section className="bg-black py-10">
                        <div className="container mx-auto px-4">
                            <h2 className="mb-6 text-2xl font-bold text-white">
                                Projected range, day by day
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[34rem] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-white">
                                            <th scope="col" className="px-3 py-3">Date</th>
                                            <th scope="col" className="px-3 py-3">Central</th>
                                            <th scope="col" className="px-3 py-3">80% range</th>
                                            <th scope="col" className="px-3 py-3">95% range</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-zinc-300">
                                        {result.points.map((p) => (
                                            <tr key={p.date} className="border-b border-white/5">
                                                <td className="px-3 py-2 font-medium text-zinc-100">
                                                    {p.date}
                                                </td>
                                                <td className="px-3 py-2">{money(p.expected)}</td>
                                                <td className="px-3 py-2">
                                                    {money(p.low80)} – {money(p.high80)}
                                                </td>
                                                <td className="px-3 py-2 text-zinc-400">
                                                    {money(p.low95)} – {money(p.high95)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-4 max-w-3xl text-sm text-zinc-400">
                                Ranges widen with the square root of the horizon, from{' '}
                                {route.name.toLowerCase()}&apos;s own recent volatility — currently
                                about {result.annualisedVolatilityPct.toFixed(1)}% annualised.
                                {anchorClose !== null && (
                                    <> Anchored to the {result.anchor.date} close of {money(anchorClose)}.</>
                                )}
                            </p>
                        </div>
                    </section>
                </>
            ) : (
                <section className="bg-black py-12">
                    <div className="container mx-auto px-4">
                        <p className="text-zinc-300">
                            There is not enough recorded history to build a projection yet. It will
                            appear automatically once more daily closes accumulate.
                        </p>
                    </div>
                </section>
            )}

            <section className="bg-zinc-900/30 py-10">
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
                        Nothing on this page is financial advice or a recommendation to buy or sell.
                        Prices are indicative reference figures and may be delayed. See the{' '}
                        <Link href="/terms" className="text-gold-400 hover:text-gold-300">
                            terms
                        </Link>
                        .
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    metal === 'XAU' ? 'goldChart' : 'silverChart',
                    metal === 'XAU' ? 'goldInsights' : 'silverInsights',
                    metal === 'XAU' ? 'goldToday' : 'silverToday',
                    'history',
                    'ratio'
                )}
            />
        </>
    );
}
