import Link from 'next/link';
import { Code2 } from 'lucide-react';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { getPrices, getHistory } from '@/lib/prices';
import { GRAMS_PER_OZ } from '@/lib/conversions';
import { breadcrumbSchema, datasetSchema, pageMetadata, SITE_URL } from '@/lib/seo';
import { describeCoverage } from '@/lib/coverage';
import { periodFaqSchema } from '@/lib/period-faq';

/**
 * Human-readable documentation for /api/data.
 *
 * The endpoint has existed and been well-formed for a while, but nothing
 * linked to it and no page explained it, so it was effectively invisible —
 * its own docstring names "developers and spreadsheet users" as an audience
 * the site could not otherwise serve, while giving them nowhere to land.
 *
 * The strategic point is links rather than rankings. A free, keyless JSON
 * endpoint is the kind of thing that gets cited from GitHub READMEs, Stack
 * Overflow answers and tutorial posts, and those are exactly the editorial
 * backlinks this domain lacks. Ranking for "free gold price API" is a bonus,
 * not the objective.
 */

export const revalidate = 10800;

export const metadata = pageMetadata({
    title: 'Free Gold & Silver Price API — JSON, No Key',
    description:
        'Free JSON API for live gold and silver prices plus daily closes since 2000. No API ' +
        'key, no rate limit, CORS enabled. Ounce, gram, kilogram, tola, pavan.',
    path: '/gold-price-api',
    keywords: [
        'free gold price api',
        'gold price api',
        'silver price api',
        'gold price json api',
        'gold historical data api',
        'gold price api no key',
        'gold price api python',
    ],
});

const ENDPOINT = `${SITE_URL}/api/data`;

export default async function GoldPriceApiPage() {
    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

    // A real response body, generated from the same data the endpoint serves,
    // so the documented example can never drift from what a caller gets.
    const sample = {
        meta: {
            source: 'ChartGoldPrice',
            currency: 'USD',
            updated_at: updatedAt,
        },
        prices: {
            gold: gold
                ? {
                      symbol: 'XAU',
                      troy_ounce: Number(gold.price.toFixed(4)),
                      gram: Number((gold.price / GRAMS_PER_OZ).toFixed(4)),
                  }
                : null,
            silver: silver
                ? {
                      symbol: 'XAG',
                      troy_ounce: Number(silver.price.toFixed(4)),
                      gram: Number((silver.price / GRAMS_PER_OZ).toFixed(4)),
                  }
                : null,
            gold_silver_ratio:
                gold && silver && silver.price > 0
                    ? Number((gold.price / silver.price).toFixed(2))
                    : null,
        },
        history: {
            available: { gold: history.gold.length, silver: history.silver.length },
        },
    };

    const facts = describeCoverage(history.gold);
    const coverage = facts ? `${facts.start} to ${facts.end}` : null;

    const questions = [
        {
            question: 'Is the gold price API really free?',
            answer:
                'Yes. There is no API key, no account, no rate limit and no paid tier. It reads ' +
                'the same committed price snapshots the website itself renders from, so serving ' +
                'it costs nothing per request. Attribution with a link back is appreciated and is ' +
                'the only condition of use.',
        },
        {
            question: 'How often is the data updated?',
            answer:
                'Spot prices refresh twice daily on a schedule, and every response carries an ' +
                'updated_at timestamp so you can see exactly how fresh the figures are rather ' +
                'than guessing. These are indicative reference prices, not live trading quotes — ' +
                'do not settle trades against them.',
        },
        {
            question: 'How do I get historical gold prices?',
            answer: facts
                ? `Add ?history=gold, ?history=silver or ?history=both to the endpoint. That ` +
                  `returns the full series as date and close pairs — ${facts.sentence}, ` +
                  `${facts.points.toLocaleString()} points in total. The same data is downloadable ` +
                  `as CSV from the chart pages if you would rather work in a spreadsheet.`
                : 'Add ?history=gold, ?history=silver or ?history=both to the endpoint to receive ' +
                  'the full close series as date and close pairs.',
        },
        {
            question: 'Can I use it from a browser?',
            answer:
                'Yes. The endpoint sends Access-Control-Allow-Origin: *, so it can be fetched ' +
                'directly from client-side JavaScript without a proxy. Responses are cached at ' +
                'the CDN edge, so repeated calls are fast and cost nothing extra.',
        },
        {
            question: 'What units are supported?',
            answer:
                'Every price is returned simultaneously per troy ounce, gram, kilogram, tola and ' +
                'pavan, so there is no need to convert client-side. The gold-to-silver ratio is ' +
                'included as well.',
        },
    ];

    const trail = [{ name: 'Free gold price API', href: '/gold-price-api' }];

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema(trail.map((c) => ({ name: c.name, path: c.href }))),
                    periodFaqSchema(questions),
                    {
                        '@context': 'https://schema.org',
                        '@type': 'WebAPI',
                        name: 'ChartGoldPrice Gold & Silver Price API',
                        description:
                            'Free JSON API for live gold and silver spot prices and a historical close series.',
                        url: `${SITE_URL}/gold-price-api`,
                        // schema.org recommends `documentation` point at a
                        // machine-readable description of the interface where
                        // one exists; the human page is already `url`.
                        documentation: `${SITE_URL}/openapi.json`,
                        endpointUrl: ENDPOINT,
                        provider: { '@type': 'Organization', name: 'ChartGoldPrice', url: SITE_URL },
                        termsOfService: `${SITE_URL}/terms`,
                        isAccessibleForFree: true,
                    },
                    // Dataset markup as well as WebAPI: Google Dataset Search
                    // indexes the former and not the latter, and this page is
                    // the canonical description of the data behind both.
                    datasetSchema({
                        name: 'Gold and silver price data',
                        description: facts
                            ? `Live gold and silver spot prices and a historical close series in ` +
                              `USD (${facts.sentence}), available as a free JSON API with no key ` +
                              `required.`
                            : 'Live gold and silver spot prices and a historical close series in ' +
                              'USD, available as a free JSON API with no key required.',
                        path: '/gold-price-api',
                        keywords: [
                            'gold price',
                            'silver price',
                            'precious metals data',
                            'free gold price api',
                            'historical gold prices',
                        ],
                        variableMeasured: 'Gold and silver price (USD per troy ounce)',
                        temporalCoverage: coverage ? coverage.replace(' to ', '/') : null,
                        distribution: [
                            {
                                encodingFormat: 'application/json',
                                contentUrl: `${SITE_URL}/api/data?history=both`,
                            },
                        ],
                    }),
                ]}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <div className="mb-3 flex items-center gap-3">
                        <Code2 className="h-8 w-8 text-gold-400" aria-hidden="true" />
                        <h1 className="text-3xl font-bold text-white md:text-4xl">
                            Free Gold &amp; Silver Price API
                        </h1>
                    </div>
                    <p className="max-w-3xl text-zinc-300">
                        Live gold and silver spot prices plus{' '}
                        {history.gold.length.toLocaleString()} historical closes
                        {facts ? ` (${facts.sentence})` : ''}, as JSON. No API key, no account, no
                        rate limit, and CORS enabled so you can call it straight from the browser.
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
                    <h2 className="mb-4 text-2xl font-bold text-white">Endpoint</h2>
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/60 p-4">
                        <code className="whitespace-nowrap text-sm text-gold-300">GET {ENDPOINT}</code>
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">
                        There is an{' '}
                        <a href="/openapi.json" className="text-gold-400 hover:text-gold-300">
                            OpenAPI 3.0 specification
                        </a>{' '}
                        for this endpoint, which Postman, Insomnia, Swagger UI and most client
                        generators can import directly.
                    </p>

                    <h3 className="mb-3 mt-8 text-lg font-semibold text-white">Query parameters</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[32rem] text-left text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Parameter
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Values
                                    </th>
                                    <th scope="col" className="px-4 py-3 font-semibold text-white">
                                        Effect
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                <tr className="border-b border-white/5">
                                    <td className="px-4 py-3 font-mono text-zinc-100">history</td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        gold | silver | both
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400">
                                        Includes the full close series. Omit it for the small
                                        current-price response.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="mb-3 mt-8 text-lg font-semibold text-white">Example response</h3>
                    <p className="mb-3 text-sm text-zinc-400">
                        Generated from the live data right now, so it cannot drift from what you
                        actually receive. Full responses also include kilogram, tola and pavan
                        prices, licence and attribution metadata.
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-900/60 p-4">
                        <pre className="text-xs leading-relaxed text-zinc-300">
                            <code>{JSON.stringify(sample, null, 2)}</code>
                        </pre>
                    </div>
                </div>
            </section>

            <section className="border-t border-white/5 bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">Examples</h2>
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-gold-300">curl</h3>
                            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3">
                                <pre className="text-xs text-zinc-300">
                                    <code>{`curl '${ENDPOINT}'`}</code>
                                </pre>
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-gold-300">JavaScript</h3>
                            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3">
                                <pre className="text-xs text-zinc-300">
                                    <code>{`const res = await fetch(
  '${ENDPOINT}'
);
const { prices } = await res.json();
console.log(prices.gold.troy_ounce);`}</code>
                                </pre>
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-gold-300">Python</h3>
                            <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3">
                                <pre className="text-xs text-zinc-300">
                                    <code>{`import requests

r = requests.get(
    "${ENDPOINT}"
)
print(r.json()["prices"]["gold"]["gram"])`}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-4 text-2xl font-bold text-white">Licence and attribution</h2>
                    <div className="mx-auto max-w-3xl space-y-4 text-zinc-300">
                        <p>
                            Free to use, including commercially, with attribution to ChartGoldPrice
                            and a link back to{' '}
                            <span className="font-mono text-sm text-gold-300">{SITE_URL}</span>. See
                            the{' '}
                            <Link href="/terms" className="text-gold-400 hover:text-gold-300">
                                terms
                            </Link>{' '}
                            for the full text.
                        </p>
                        <p className="text-sm text-zinc-400">
                            These are indicative reference prices, may be delayed, and are not
                            trading quotes or financial advice. Do not settle trades against them.
                            The service is provided as-is with no uptime guarantee — if you need an
                            SLA, use a commercial provider.
                        </p>
                    </div>
                </div>
            </section>

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
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks(
                    'goldChart',
                    'goldInsights',
                    'goldForecast',
                    'silverForecast',
                    'history',
                    'silverHistory'
                )}
            />
        </>
    );
}
