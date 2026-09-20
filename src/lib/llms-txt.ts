/**
 * Builds the body of /llms.txt.
 *
 * Extracted from the route so it can be tested without a server or a data
 * layer, which matters more here than for most templates: this file's entire
 * audience is machines that follow URLs. Every address it prints is a promise
 * that something is there.
 *
 * It did not used to keep that promise. The "key pages" list described route
 * shapes with placeholders — /gold-price/YYYY, /silver-price/..., and
 * /gold-price-in/{usd,eur,gbp,inr,...} — which read perfectly to a person and
 * are indistinguishable from real URLs to a crawler. Google duly fetched them
 * and reported the 404s. The {usd,...} form was worse than a placeholder: it
 * advertised a currency that has no page at all, because the site is priced in
 * USD natively.
 *
 * So the rule this file follows now: print only URLs that resolve, and name
 * variants in prose. A pattern a reader has to expand is not a link.
 *
 * Deliberately free of imports. Node runs this file directly from the test
 * under its TypeScript stripping, which resolves specifiers the way the
 * runtime does rather than the way the bundler does — so an import of
 * './navigation' that Next resolves happily fails there. Everything it needs
 * arrives as an argument, which is also what makes the degraded cases below
 * testable.
 */

/** Live archive URLs for one metal, one per granularity. */
export interface ArchiveExamples {
    year: string;
    month: string;
    day: string;
}

export interface LlmsTxtInput {
    siteUrl: string;
    goldPrice: number | null;
    silverPrice: number | null;
    perGram: (ozPrice: number) => string;
    updatedAt: string | null;
    firstDate: string | null;
    coverage: string;
    source: string | null;
    points: number;
    /**
     * Built from the newest date we actually hold, not hardcoded: a pinned
     * "10-august-2026" rots into a 404 the moment the archive moves past it,
     * which is the same bug as a placeholder, only slower.
     */
    goldArchive: ArchiveExamples | null;
    silverArchive: ArchiveExamples | null;
}

export function buildLlmsTxt(input: LlmsTxtInput): string {
    const {
        siteUrl,
        goldPrice,
        silverPrice,
        perGram,
        updatedAt,
        firstDate,
        coverage,
        source,
        points,
        goldArchive,
        silverArchive,
    } = input;

    // With no history there is nothing dated to point at, so point at the page
    // that lists the archive instead of inventing an address for it.
    const archiveLines =
        goldArchive && silverArchive
            ? [
                  `- ${goldArchive.year} — gold archive for one year. ${goldArchive.month} is a month and ${goldArchive.day} a single day.`,
                  `- ${silverArchive.year} — the same archive for silver, in the same three shapes.`,
              ]
            : [`- ${siteUrl}/gold-price-history — the gold archive, by year, month and day.`];

    return `# ChartGoldPrice

> Gold and silver spot prices, historical archives back to ${firstDate ?? 'n/a'},
> a karat/fineness value calculator, and computed analytics (moving averages,
> volatility, drawdowns, annual returns, seasonality). All figures are derived
> from our own recorded price series, not republished from third parties.

## Current prices (USD, updated ${updatedAt ?? 'unknown'})

${goldPrice ? `- Gold (XAU): $${goldPrice.toFixed(2)} per troy ounce | $${perGram(goldPrice)} per gram` : '- Gold: unavailable'}
${silverPrice ? `- Silver (XAG): $${silverPrice.toFixed(2)} per troy ounce | $${perGram(silverPrice)} per gram` : '- Silver: unavailable'}
${goldPrice && silverPrice ? `- Gold/silver ratio: ${(goldPrice / silverPrice).toFixed(1)}` : ''}

A troy ounce is exactly 31.1034768 grams. A tola is 11.6638038 g; a pavan is 8 g.
Karat purity is karat/24 (24K = 100%, 22K = 91.7%, 18K = 75%).
Silver fineness: .999 fine, .925 sterling, .900 coin silver.

## Machine-readable data

- JSON API: ${siteUrl}/api/data — current prices, plus optional history
- OpenAPI spec: ${siteUrl}/openapi.json — machine-readable description of the API
- API docs: ${siteUrl}/gold-price-api — endpoint, parameters, examples, licence
- Historical coverage: ${coverage} (USD per troy ounce, ${points} points)
- Source: ${source ?? 'unknown'}

## Key pages

- ${siteUrl}/gold-price-today — current gold price, 8 currencies
- ${siteUrl}/silver-price-today — current silver price
- ${siteUrl}/charts/gold — interactive gold chart, 1W to full record
- ${siteUrl}/charts/silver — interactive silver chart
- ${siteUrl}/gold-price-history — historical gold charts and annual returns
- ${siteUrl}/silver-price-history — historical silver charts and annual returns
- ${siteUrl}/gold-price-insights — moving averages, volatility, drawdowns, seasonality
- ${siteUrl}/silver-price-insights — the same analytics for silver
${archiveLines.join('\n')}
- ${siteUrl}/gold-price-per/gram — price by weight unit; ounce, kilo, tola and pavan take the same form
- ${siteUrl}/silver-price-per/gram — by unit and fineness
- ${siteUrl}/gold-price-in/eur — price in a local currency; also gbp, inr, cad, aud, jpy and cny
- ${siteUrl}/gold-price-calculator — value jewellery or bullion by weight and purity
- ${siteUrl}/gold-scrap-calculator — scrap gold value and what buyers actually pay
- ${siteUrl}/melt-value — coin melt values and junk silver calculator
- ${siteUrl}/gold-price-forecast — 7-day projection with measured accuracy vs a no-change benchmark
- ${siteUrl}/silver-price-forecast — the same for silver
- ${siteUrl}/platinum-price — platinum spot price, fineness values and demand drivers
- ${siteUrl}/palladium-price — palladium spot price and autocatalyst demand

## Usage

Free to cite with attribution to ChartGoldPrice (${siteUrl}).
Terms: ${siteUrl}/terms

Prices are indicative reference figures sourced from third parties, may be
delayed, and are not trading quotes. Nothing here is financial advice.
`;
}

/**
 * Every URL on this site that a body advertises.
 *
 * Exists for the test, which is its whole justification: a placeholder that
 * creeps back into the template should fail a run, not wait to be noticed in a
 * Search Console report weeks later.
 */
export function siteUrlsIn(body: string, siteUrl: string): string[] {
    const escaped = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = body.matchAll(new RegExp(`${escaped}[^\\s]*`, 'g'));

    // One trailing punctuation mark, not a run of them. "…/terms." is a URL at
    // the end of a sentence, but "…/silver-price/..." is the placeholder this
    // whole guard exists to catch, and stripping greedily would hide it.
    return [...new Set([...matches].map((m) => m[0].replace(/[.,;)]$/, '')))];
}
