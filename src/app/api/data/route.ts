import { NextResponse } from 'next/server';

import { getPrices, getHistory } from '@/lib/prices';
import { GRAMS_PER_OZ, GRAMS_PER_KG, GRAMS_PER_TOLA, GRAMS_PER_PAVAN } from '@/lib/conversions';
import { SITE_URL } from '@/lib/navigation';

/**
 * Public, documented JSON endpoint.
 *
 * Two audiences, one cheap route:
 *  - AI assistants and answer engines, which already find this site for
 *    machine-shaped price queries and would otherwise scrape a rendered page
 *  - developers and spreadsheet users, a group with real search demand that
 *    an HTML-only site cannot serve at all
 *
 * Reads the committed snapshots, so it costs no upstream API quota no matter
 * how often it is called, and is CDN-cacheable like every other route here.
 *
 * `?history=gold|silver|both` opts into the full daily series; the default
 * response stays small because most callers only want the current price.
 */

export const revalidate = 10800;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const wanted = (searchParams.get('history') ?? '').toLowerCase();
    const includeGold = wanted === 'gold' || wanted === 'both';
    const includeSilver = wanted === 'silver' || wanted === 'both';

    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

    const byWeight = (pricePerOz: number) => ({
        troy_ounce: Number(pricePerOz.toFixed(4)),
        gram: Number((pricePerOz / GRAMS_PER_OZ).toFixed(4)),
        kilogram: Number(((pricePerOz / GRAMS_PER_OZ) * GRAMS_PER_KG).toFixed(2)),
        tola: Number(((pricePerOz / GRAMS_PER_OZ) * GRAMS_PER_TOLA).toFixed(4)),
        pavan: Number(((pricePerOz / GRAMS_PER_OZ) * GRAMS_PER_PAVAN).toFixed(4)),
    });

    return NextResponse.json(
        {
            meta: {
                source: 'ChartGoldPrice',
                url: SITE_URL,
                license: `${SITE_URL}/terms`,
                attribution: 'Free to use with attribution to ChartGoldPrice',
                disclaimer:
                    'Indicative reference prices, may be delayed, not trading quotes. Not financial advice.',
                currency: 'USD',
                updated_at: updatedAt,
                history_source: history.source,
                docs: `${SITE_URL}/llms.txt`,
            },
            prices: {
                gold: gold ? { symbol: 'XAU', ...byWeight(gold.price) } : null,
                silver: silver ? { symbol: 'XAG', ...byWeight(silver.price) } : null,
                gold_silver_ratio:
                    gold && silver && silver.price > 0
                        ? Number((gold.price / silver.price).toFixed(2))
                        : null,
            },
            history: {
                available: {
                    gold: history.gold.length,
                    silver: history.silver.length,
                },
                usage: `Add ?history=gold, ?history=silver or ?history=both to include daily closes`,
                gold: includeGold ? history.gold : undefined,
                silver: includeSilver ? history.silver : undefined,
            },
        },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
                // Explicitly open: the point is to be consumed and cited.
                'Access-Control-Allow-Origin': '*',
            },
        }
    );
}
