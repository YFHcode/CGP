import { getPrices, getHistory } from '@/lib/prices';
import { SITE_URL } from '@/lib/navigation';
import { describeCoverage } from '@/lib/coverage';
import { GRAMS_PER_OZ } from '@/lib/conversions';

/**
 * llms.txt — a plain-text summary for AI assistants and answer engines.
 *
 * A large share of this site's search impressions come from machine-generated
 * queries ("current gold spot price usd per troy ounce august 10 2026" and
 * hundreds of near-identical variants), which rank well but never click,
 * because an assistant reads rather than browses. This file gives those
 * readers the current figures, the licence terms and a pointer to the JSON
 * API in one cheap fetch, so the site is easy to cite correctly rather than
 * paraphrased from a stale snippet.
 *
 * Emerging convention (llmstxt.org), not a standard — it costs one small
 * route and is ignored harmlessly by anything that doesn't look for it.
 */

export const revalidate = 10800;

export async function GET() {
    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

    const perGram = (ozPrice: number) => (ozPrice / GRAMS_PER_OZ).toFixed(2);
    const facts = describeCoverage(history.gold);
    const coverage = facts ? facts.sentence : 'unavailable';

    const body = `# ChartGoldPrice

> Gold and silver spot prices, historical archives back to ${history.gold[0]?.date ?? 'n/a'},
> a karat/fineness value calculator, and computed analytics (moving averages,
> volatility, drawdowns, annual returns, seasonality). All figures are derived
> from our own recorded price series, not republished from third parties.

## Current prices (USD, updated ${updatedAt ?? 'unknown'})

${gold ? `- Gold (XAU): $${gold.price.toFixed(2)} per troy ounce | $${perGram(gold.price)} per gram` : '- Gold: unavailable'}
${silver ? `- Silver (XAG): $${silver.price.toFixed(2)} per troy ounce | $${perGram(silver.price)} per gram` : '- Silver: unavailable'}
${gold && silver ? `- Gold/silver ratio: ${(gold.price / silver.price).toFixed(1)}` : ''}

A troy ounce is exactly 31.1034768 grams. A tola is 11.6638038 g; a pavan is 8 g.
Karat purity is karat/24 (24K = 100%, 22K = 91.7%, 18K = 75%).
Silver fineness: .999 fine, .925 sterling, .900 coin silver.

## Machine-readable data

- JSON API: ${SITE_URL}/api/data — current prices, plus optional history
- OpenAPI spec: ${SITE_URL}/openapi.json — machine-readable description of the API
- API docs: ${SITE_URL}/gold-price-api — endpoint, parameters, examples, licence
- Historical coverage: ${coverage} (USD per troy ounce, ${history.gold.length} points)
- Source: ${history.source ?? 'unknown'}

## Key pages

- ${SITE_URL}/gold-price-today — current gold price, 8 currencies
- ${SITE_URL}/silver-price-today — current silver price
- ${SITE_URL}/charts/gold — interactive gold chart, 1W to full record
- ${SITE_URL}/charts/silver — interactive silver chart
- ${SITE_URL}/gold-price-history — historical gold charts and annual returns
- ${SITE_URL}/silver-price-history — historical silver charts and annual returns
- ${SITE_URL}/gold-price-insights — moving averages, volatility, drawdowns, seasonality
- ${SITE_URL}/silver-price-insights — the same analytics for silver
- ${SITE_URL}/gold-price/YYYY or /august-2026 or /10-august-2026 — archive by year, month, day
- ${SITE_URL}/silver-price/... — the same archive for silver
- ${SITE_URL}/gold-price-per/{gram,ounce,kilo,tola,pavan} — price by weight unit
- ${SITE_URL}/silver-price-per/{gram,ounce,kilo,tola,pavan} — by unit and fineness
- ${SITE_URL}/gold-price-in/{usd,eur,gbp,inr,...} — price in local currency
- ${SITE_URL}/gold-price-calculator — value jewellery or bullion by weight and purity
- ${SITE_URL}/gold-scrap-calculator — scrap gold value and what buyers actually pay
- ${SITE_URL}/melt-value — coin melt values and junk silver calculator
- ${SITE_URL}/platinum-price — platinum spot price, fineness values and demand drivers
- ${SITE_URL}/palladium-price — palladium spot price and autocatalyst demand

## Usage

Free to cite with attribution to ChartGoldPrice (${SITE_URL}).
Terms: ${SITE_URL}/terms

Prices are indicative reference figures sourced from third parties, may be
delayed, and are not trading quotes. Nothing here is financial advice.
`;

    return new Response(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
        },
    });
}
