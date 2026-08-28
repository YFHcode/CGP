import Link from 'next/link';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { getHistory } from '@/lib/prices';
import { METAL_ROUTES, getPeriodStats, listPeriods, parsePeriod, slugForKey } from '@/lib/history-periods';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import type { MetalSymbol } from '@/types';

/** Index of every period page, so the archive is crawlable from one hub. */

export function archiveMetadata(metal: MetalSymbol) {
    const route = METAL_ROUTES[metal];
    const name = route.name.toLowerCase();
    return pageMetadata({
        title: `${route.name} Price History Archive`,
        description: `Browse ${name} prices by year, month and day. Closing prices, highs, lows and averages for every period on record.`,
        path: route.base,
        keywords: [`${name} price history`, `${name} price archive`, `historical ${name} prices`],
    });
}

export async function renderArchiveIndex(metal: MetalSymbol) {
    const route = METAL_ROUTES[metal];
    const history = await getHistory();
    const series = metal === 'XAU' ? history.gold : history.silver;

    const years = listPeriods(series, 'year').reverse();
    const months = listPeriods(series, 'month').reverse();
    const name = route.name.toLowerCase();

    const trail = [{ name: `${route.name} price history`, href: route.base }];

    return (
        <>
            <JsonLd
                schema={breadcrumbSchema([
                    { name: `${route.name} price history`, path: route.base },
                ])}
            />
            <Breadcrumbs trail={trail} />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        {route.name} price history archive
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        Every {name} closing price we hold, organised by year, month and day. Each
                        page shows the high, low, average and daily closes for that period.
                    </p>
                </div>
            </section>

            {series.length === 0 ? (
                <section className="bg-black py-12">
                    <div className="container mx-auto px-4">
                        <p className="text-zinc-300">
                            No price history has been collected yet. Data is gathered on a schedule
                            and this archive will fill in automatically.
                        </p>
                    </div>
                </section>
            ) : (
                <>
                    <section className="bg-black py-10">
                        <div className="container mx-auto px-4">
                            <h2 className="mb-4 text-2xl font-bold text-white">By year</h2>
                            <ul className="flex flex-wrap gap-3">
                                {years.map((year) => {
                                    const stats = getPeriodStats(series, parsePeriod(year)!);
                                    return (
                                        <li key={year}>
                                            <Link
                                                href={`${route.base}/${slugForKey(year, 'year')}`}
                                                className="block rounded-lg border border-white/10 px-5 py-3 transition-colors hover:border-gold-500/30 hover:text-gold-300"
                                            >
                                                <span className="block font-semibold text-white">{year}</span>
                                                {stats && (
                                                    <span className="text-xs text-zinc-400">
                                                        avg $
                                                        {stats.average.toLocaleString('en-US', {
                                                            maximumFractionDigits: 0,
                                                        })}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </section>

                    <section className="bg-zinc-900/30 py-10">
                        <div className="container mx-auto px-4">
                            <h2 className="mb-4 text-2xl font-bold text-white">By month</h2>
                            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {months.map((month) => {
                                    const period = parsePeriod(month)!;
                                    const stats = getPeriodStats(series, period);
                                    return (
                                        <li key={month}>
                                            <Link
                                                href={`${route.base}/${slugForKey(month, 'month')}`}
                                                className="flex items-baseline justify-between gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm transition-colors hover:border-gold-500/30"
                                            >
                                                <span className="text-zinc-200">{period.label}</span>
                                                {stats && (
                                                    <span className="shrink-0 text-xs text-zinc-400">
                                                        $
                                                        {stats.close.toLocaleString('en-US', {
                                                            maximumFractionDigits: 0,
                                                        })}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </section>
                </>
            )}

            <RelatedLinks
                links={relatedLinks(
                    metal === 'XAU' ? 'goldToday' : 'silverToday',
                    metal === 'XAU' ? 'goldInsights' : 'silverInsights',
                    metal === 'XAU' ? 'goldForecast' : 'silverForecast',
                    'calculator',
                    'history',
                    'news'
                )}
            />
        </>
    );
}
