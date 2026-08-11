import { notFound, redirect } from 'next/navigation';

import { PeriodPage } from '@/components/PeriodPage';
import { getHistory } from '@/lib/prices';
import {
    METAL_ROUTES,
    getPeriodStats,
    listPeriods,
    parsePeriod,
    slugForKey,
} from '@/lib/history-periods';
import { pageMetadata } from '@/lib/seo';
import { findNotableDays } from '@/lib/notable-days';
import { computeDayHeadline } from '@/lib/day-headline';
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

    // Emit canonical readable slugs, not ISO keys.
    return [
        ...listPeriods(series, 'year').map((key) => slugForKey(key, 'year')),
        ...listPeriods(series, 'month').map((key) => slugForKey(key, 'month')),
        ...listPeriods(series, 'day').slice(-120).map((key) => slugForKey(key, 'day')),
    ].map((period) => ({ period }));
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

    // A real "highest since X" / "biggest move" headline, when the day has
    // one — leads the description the way a news search result does.
    const headline =
        period.kind === 'day' ? computeDayHeadline(seriesFor(metal, history), period.key, route.name) : null;
    const headlinePrefix = headline ? `${headline.text}. ` : '';

    const description =
        period.kind === 'day'
            ? stats.isComplete
                ? `${headlinePrefix}${route.name} closed at ${money(stats.close)} per troy ounce on ${period.label}. See the full day's figures and how it compares with the previous close.`
                : `${headlinePrefix}${route.name} was last quoted at ${money(stats.close)} per troy ounce on ${period.label}, with trading still in progress. See the latest figures and how they compare with the previous close.`
            : stats.isComplete
              ? `${route.name} averaged ${money(stats.average)} per troy ounce ${preposition} ${period.label}, ranging from ${money(stats.low)} to ${money(stats.high)}. Daily closes, chart and summary statistics.`
              : `${route.name} has averaged ${money(stats.average)} per troy ounce ${preposition} ${period.label} so far, ranging from ${money(stats.low)} to ${money(stats.high)}. Daily closes, chart and summary statistics, updated as the ${period.kind === 'year' ? 'year' : 'month'} continues.`;

    // The headline figure goes in the title: it is what searchers are looking
    // for, and it makes the result far more clickable than a bare date. When
    // the day has a real story, its compact form leads the title over the
    // generic "per Ounce" — that's the difference between a result that
    // reads like every other date page and one that reads like news.
    const title =
        period.kind === 'day'
            ? headline
                ? `${route.name} Price on ${period.label}: ${money(stats.close)} — ${headline.shortText}`
                : `${route.name} Price on ${period.label}: ${money(stats.close)} per Ounce`
            : `${route.name} Price in ${period.label}: ${money(stats.low)}–${money(stats.high)} per Ounce`;

    return pageMetadata({
        title,
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

    // Old ISO URLs still resolve, but redirect to the canonical readable slug
    // so the same content is never served at two addresses.
    if (periodSlug !== period.slug) {
        redirect(`${METAL_ROUTES[metal].base}/${period.slug}`);
    }

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
            notableReasons={findNotableDays(series).get(period.key) ?? []}
        />
    );
}
