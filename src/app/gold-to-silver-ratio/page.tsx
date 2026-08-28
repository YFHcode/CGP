import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { LastUpdated } from '@/components/LastUpdated';
import { getPrices, getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { goldSilverRatio } from '@/lib/conversions';
import { periodFaqSchema } from '@/lib/period-faq';

export const revalidate = 10800;

/** Builds the ratio series by pairing both metals on matching dates. */
function ratioSeries(gold: { date: string; close: number }[], silver: { date: string; close: number }[]) {
    const silverByDate = new Map(silver.map((p) => [p.date, p.close]));
    const series: { date: string; ratio: number }[] = [];
    for (const point of gold) {
        const s = silverByDate.get(point.date);
        if (s && s > 0) series.push({ date: point.date, ratio: point.close / s });
    }
    return series;
}

export const metadata = pageMetadata({
    title: 'Gold to Silver Ratio Today — Chart & History',
    description:
        'The live gold to silver ratio, how many ounces of silver buy one ounce of gold, with its recent range, historical average and what the ratio signals.',
    path: '/gold-to-silver-ratio',
    keywords: [
        'gold to silver ratio',
        'gold silver ratio today',
        'gold silver ratio chart',
        'silver to gold ratio',
    ],
});

export default async function GoldSilverRatioPage() {
    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);
    const series = ratioSeries(history.gold, history.silver);

    const current = gold && silver ? goldSilverRatio(gold.price, silver.price) : Number.NaN;
    const ratios = series.map((p) => p.ratio);
    const average = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : Number.NaN;

    let high = series[0];
    let low = series[0];
    for (const point of series) {
        if (point.ratio > high.ratio) high = point;
        if (point.ratio < low.ratio) low = point;
    }

    const n = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

    const questions = [
        {
            question: 'What is the gold to silver ratio today?',
            answer:
                `The gold to silver ratio is currently about ${n(current)}, meaning one troy ounce ` +
                `of gold is worth roughly ${n(current)} ounces of silver at today's prices.`,
        },
        {
            question: 'What does the gold to silver ratio mean?',
            answer:
                'It is simply the gold price divided by the silver price. A high ratio means silver ' +
                'is cheap relative to gold; a low ratio means the opposite. Traders watch it to ' +
                'judge which metal offers better relative value, and some switch between the two ' +
                'when it reaches an extreme.',
        },
        {
            question: 'What is a normal gold to silver ratio?',
            answer:
                'There is no fixed normal. For much of the twentieth century it sat between roughly ' +
                '40 and 80, but it has spent long stretches outside that band, spiking above 100 ' +
                'during market stress in 2020. ' +
                (Number.isFinite(average)
                    ? `Across the ${series.length} sessions on record here it has averaged ${n(average)}.`
                    : ''),
        },
        ...(series.length > 1
            ? [
                  {
                      question: 'What is the recent range of the gold to silver ratio?',
                      answer:
                          `Over the ${series.length} trading days on record the ratio has ranged ` +
                          `from ${n(low.ratio)} to ${n(high.ratio)}, averaging ${n(average)}.`,
                  },
              ]
            : []),
        {
            question: 'How do you calculate the gold to silver ratio?',
            answer:
                'Divide the gold price per troy ounce by the silver price per troy ounce. Both must ' +
                'be in the same currency and the same unit — using a gram price for one and an ' +
                'ounce price for the other is the most common mistake.',
        },
    ];

    const trail = [{ name: 'Gold to silver ratio', href: '/gold-to-silver-ratio' }];

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
                        Gold to Silver Ratio Today
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        The gold to silver ratio is{' '}
                        <strong className="text-white">{n(current)}</strong> — one ounce of gold buys
                        about {n(current)} ounces of silver at current prices.
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
                    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {[
                            { label: 'Current ratio', value: n(current) },
                            { label: 'Average on record', value: n(average) },
                            {
                                label: 'Highest',
                                value: series.length ? n(high.ratio) : '—',
                                sub: series.length ? high.date : undefined,
                            },
                            {
                                label: 'Lowest',
                                value: series.length ? n(low.ratio) : '—',
                                sub: series.length ? low.date : undefined,
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-xl border border-white/10 bg-zinc-900/50 p-4"
                            >
                                <dt className="text-xs text-zinc-400">{item.label}</dt>
                                <dd className="mt-1 text-xl font-bold text-white">{item.value}</dd>
                                {item.sub && <dd className="mt-1 text-xs text-zinc-400">{item.sub}</dd>}
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            <section className="bg-zinc-900/30 py-10">
                <div className="container mx-auto px-4">
                    <h2 className="mb-6 text-2xl font-bold text-white">
                        Gold to silver ratio: common questions
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
                links={relatedLinks('goldToday', 'silverToday', 'goldArchive', 'silverArchive', 'calculator', 'history')}
            />
        </>
    );
}
