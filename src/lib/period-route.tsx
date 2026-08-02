import { notFound } from 'next/navigation';

import { PeriodPage } from '@/components/PeriodPage';
import { getHistory } from '@/lib/prices';
import {
    METAL_ROUTES,
    getPeriodStats,
    listPeriods,
    parsePeriod,
} from '@/lib/history-periods';
import { pageMetadata } from '@/lib/seo';
import type { MetalSymbol } from '@/types';

/**
 * Shared implementation for /gold-price/[period] and /silver-price/[period].
 *
 * Every figure comes from the price history this project accumulates itself,
 * so these pages are first-party data rather than republished content.
 */

function seriesFor(
    metal: MetalSymbol,
    history: { gold: { date: string; close: number }[]; silver: { date: string; close: number }[] }
) {
    return metal === 'XAU' ? history.gold : history.silver;
}

/**
 * Prerender years, months and the most recent 120 days. Older days still work
 * — they render on demand and are then cached — which keeps build times sane
 * as the archive grows.
 */
export async function periodStaticParams(metal: MetalSymbol) {
    const history = await getHistory();
    const series = seriesFor(metal, history);

    const years = listPeriods(series, 'year');
    const months = listPeriods(series, 'month');
    const recentDays = listPeriods(series, 'day').slice(-120);

    return [...years, ...months, ...recentDays].map((period) => ({ period }));
}

export async function periodMetadata(metal: MetalSymbol, periodSlug: string) {
    const route = METAL_ROUTES[metal];
    const period = parsePeriod(periodSlug);

    if (!period) {
        return pageMetadata({
            title: 'Period not found',
            description: 'No price data exists for this period.',
            path: `${route.base}/${periodSlug}`,
            noIndex: true,
        });
    }

    const history = await getHistory();
    const stats = getPeriodStats(seriesFor(metal, history), period);

    if (!stats) {
        return pageMetadata({
            title: `${route.name} price, ${period.label}`,
            description: 'No price data is available for this period.',
            path: `${route.base}/${period.slug}`,
            noIndex: true,
        });
    }

    const name = route.name.toLowerCase();
    const preposition = period.kind === 'day' ? 'on' : 'in';
    const money = (v: number) =>
        v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

    const description =
        period.kind === 'day'
            ? `${route.name} closed at ${money(stats.close)} per troy ounce on ${period.label}. See the full day's figures and how it compares with the previous close.`
            : `${route.name} averaged ${money(stats.average)} per troy ounce ${preposition} ${period.label}, ranging from ${money(stats.low)} to ${money(stats.high)}. Daily closes, chart and summary statistics.`;

    return pageMetadata({
        title: `${route.name} Price ${preposition === 'on' ? 'on' : 'in'} ${period.label}`,
        description,
        path: `${route.base}/${period.slug}`,
        keywords: [
            `${name} price ${period.label.toLowerCase()}`,
            `${name} price history`,
            `${name} price ${period.slug}`,
        ],
    });
}

export async function renderPeriodPage(metal: MetalSymbol, periodSlug: string) {
    const period = parsePeriod(periodSlug);
    if (!period) notFound();

    const history = await getHistory();
    const series = seriesFor(metal, history);
    const stats = getPeriodStats(series, period);

    // A period with no data must 404 rather than publish an empty page.
    if (!stats) notFound();

    return (
        <PeriodPage
            metal={metal}
            stats={stats}
            series={series}
            otherSeries={metal === 'XAU' ? history.silver : history.gold}
            source={history.source}
        />
    );
}
