import { notFound, redirect } from 'next/navigation';

import { PeriodPage } from '@/components/PeriodPage';
import { ClosedDayPage } from '@/components/ClosedDayPage';
import { describeClosedDay, closureSentence } from '@/lib/closed-days';
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
        /**
         * A weekend or a session the market did not settle, inside the range we
         * cover. These used to fall through to notFound(), which Next then
         * prerendered and served as HTTP 200 with a "Page not found" body —
         * about six thousand soft 404s under real-looking titles.
         *
         * noIndex, follow is deliberate and not a hedge. Six thousand pages
         * sharing one structure is the scaled-content pattern to avoid, and a
         * date with no price has nothing of its own to rank for. The page
         * exists for whoever lands on it, and so link equity reaches the two
         * real sessions either side.
         */
        const closed =
            period.kind === 'day'
                ? describeClosedDay(seriesFor(metal, history), period.key)
                : null;

        if (closed) {
            return pageMetadata({
                title: `${route.name} Price on ${period.label} — Market Closed`,
                description: closureSentence(closed, route.name).slice(0, 155),
                path: `${route.base}/${period.slug}`,
                noIndex: true,
            });
        }

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

    /**
     * Title-only money: whole dollars once past $100.
     *
     * Google truncates titles at roughly 60 characters, so "$4,033.70–$4,435.50"
     * spends six of them on cents that tell a searcher nothing at gold's scale.
     * Below $100 the cents are kept — silver trades in them, and rounding
     * $56.85 to $57 would discard real precision.
     */
    const titleMoney = (v: number) =>
        v.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: v >= 100 ? 0 : 2,
        });

    // A real "highest since X" / "biggest move" headline, when the day has
    // one — leads the description the way a news search result does.
    const headline =
        period.kind === 'day' ? computeDayHeadline(seriesFor(metal, history), period.key, route.name) : null;
    const headlinePrefix = headline ? `${headline.text}. ` : '';

    /**
     * Descriptions are kept under ~155 characters, where Google truncates.
     * The figures lead and the closing sentence is short enough to survive,
     * so the snippet reads as finished rather than cut off mid-clause — the
     * previous versions ran to ~180 and lost their tail every time.
     */
    const description =
        period.kind === 'day'
            ? stats.isComplete
                ? `${headlinePrefix}${route.name} closed at ${money(stats.close)} per troy ounce on ${period.label}. Full day's figures, chart and previous close.`
                : `${headlinePrefix}${route.name} was last quoted at ${money(stats.close)} per troy ounce on ${period.label}, with trading in progress. Latest figures and previous close.`
            : stats.isComplete
              ? `${route.name} averaged ${money(stats.average)} per troy ounce ${preposition} ${period.label}, ranging from ${money(stats.low)} to ${money(stats.high)}. Daily closes and chart.`
              : `${route.name} has averaged ${money(stats.average)} per troy ounce ${preposition} ${period.label} so far, ranging from ${money(stats.low)} to ${money(stats.high)}. Daily closes and chart.`;

    // The headline figure goes in the title: it is what searchers are looking
    // for, and it makes the result far more clickable than a bare date. When
    // the day has a real story, its compact form leads the title over the
    // generic "per Ounce" — that's the difference between a result that
    // reads like every other date page and one that reads like news.
    //
    // The period's own date stays in full ("18 September 2024"), because that
    // is how the queries are typed — Search Console shows "gold price on 18
    // september 2024" verbatim — and matching the query text gets it bolded.
    const title =
        period.kind === 'day'
            ? headline
                ? `${route.name} Price on ${period.label}: ${titleMoney(stats.close)} — ${headline.shortText}`
                : `${route.name} Price on ${period.label}: ${titleMoney(stats.close)} per Ounce`
            : `${route.name} Price in ${period.label}: ${titleMoney(stats.low)}–${titleMoney(stats.high)} per Ounce`;

    const meta = pageMetadata({
        title,
        description,
        path: `${route.base}/${period.slug}`,
        keywords: [
            `${name} price ${period.label.toLowerCase()}`,
            `${name} price history`,
            `${name} price ${period.slug}`,
        ],
    });

    return {
        ...meta,
        // Suppress the root layout's "| ChartGoldPrice" template on archive
        // pages only. These titles already run to the truncation limit, and
        // the suffix costs 16 characters that were pushing the price figure
        // and headline out of the visible result. A brand suffix earns its
        // place once the brand is worth recognising; until then it is the
        // least valuable text in the tag. Other pages keep the template.
        title: { absolute: title },
    };
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

    // A day inside our range with no close is a weekend or a market holiday,
    // not a missing page. Answer the question instead of 404ing it.
    if (!stats) {
        const closed =
            period.kind === 'day' ? describeClosedDay(series, period.key) : null;
        if (closed) {
            return (
                <ClosedDayPage
                    metal={metal}
                    period={period}
                    closed={closed}
                    routeBase={METAL_ROUTES[metal].base}
                    metalName={METAL_ROUTES[metal].name}
                />
            );
        }
        // Genuinely outside the range we hold, so genuinely not found.
        notFound();
    }

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
