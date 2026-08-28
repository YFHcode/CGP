import { Hero } from '@/components/Hero';
import { MinorMetalStrip } from '@/components/MinorMetalStrip';
import { MarketPulse } from '@/components/MarketPulse';
import { ToolDirectory } from '@/components/ToolDirectory';
import { LazyExploreChart } from '@/components/LazyExploreChart';
import { NewsSection } from '@/components/NewsSection';
import { AnalysisSection } from '@/components/AnalysisSection';
import { GoldCalculator } from '@/components/GoldCalculator';
import { JsonLd } from '@/components/JsonLd';
import { getPrices, getHistory, getMinorMetal } from '@/lib/prices';
import { computeHomeInsights } from '@/lib/home-insights';
import { faqSchema, pageMetadata } from '@/lib/seo';

/**
 * Homepage.
 *
 * Ordered by what a visitor needs first and how specific it is:
 *
 *   1. the prices, live, because that is what most arrivals came for
 *   2. context they cannot get from a search result — where today sits in the
 *      record, where the ratio sits historically, the week ahead
 *   3. the interactive chart, for anyone who wants to look rather than read
 *   4. one calculator inline, since valuing metal is the most common task
 *   5. a full directory of everything else
 *
 * The directory replaces the six-link "related pages" block that ended the
 * page when the site had roughly six destinations. It now has four metals,
 * daily history back to 2000, forecasts, technical charts, five calculators
 * and a public API, and none of that was reachable from the front page without
 * opening a nav dropdown.
 */

export const metadata = pageMetadata({
    title: 'Gold & Silver Prices Today — Charts & Forecasts',
    description:
        'Live gold, silver, platinum and palladium prices with charts, 7-day forecasts, ' +
        'a karat value calculator and daily history back to 2000.',
    path: '/',
    keywords: [
        'gold price',
        'silver price',
        'gold chart',
        'gold price forecast',
        'gold value calculator',
        'XAU USD',
        'XAG USD',
        'gold silver ratio',
    ],
});

export default async function Home() {
    const [{ gold, silver, updatedAt }, history, platinum, palladium] = await Promise.all([
        getPrices(),
        getHistory(),
        getMinorMetal('XPT'),
        getMinorMetal('XPD'),
    ]);

    const insights = computeHomeInsights(gold, silver, history.gold, history.silver);

    return (
        <>
            <JsonLd schema={faqSchema(gold?.price, updatedAt)} />

            <Hero
                goldData={gold}
                silverData={silver}
                updatedAt={updatedAt}
                heading={
                    <>
                        Gold &amp; Silver Prices{' '}
                        <span className="bg-gradient-to-r from-gold-300 to-gold-600 bg-clip-text text-transparent">
                            Today
                        </span>
                    </>
                }
                subheading="Live spot prices in eight currencies, with technical charts, seven-day forecasts and daily history back to 2000."
            />

            <MinorMetalStrip platinum={platinum.quote} palladium={palladium.quote} />

            <MarketPulse insights={insights} />

            <LazyExploreChart gold={history.gold} silver={history.silver} source={history.source} />

            <AnalysisSection gold={gold} silver={silver} />

            {gold && (
                <section className="bg-black py-12">
                    <div className="container mx-auto px-4">
                        <GoldCalculator goldPricePerOz={gold.price} />
                    </div>
                </section>
            )}

            <ToolDirectory />

            <NewsSection />
        </>
    );
}
