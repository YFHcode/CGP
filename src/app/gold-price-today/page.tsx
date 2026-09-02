import Link from 'next/link';

import { Hero } from '@/components/Hero';
import { LazyPriceChart } from '@/components/LazyPriceChart';
import { MetalDataPanel } from '@/components/MetalDataPanel';
import { NewsSection } from '@/components/NewsSection';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices, getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { regionalEnglishAlternates } from '@/lib/locale-pages';
import { formatLongDate, utcDateOf } from '@/lib/history-periods';
import { formatCurrency } from '@/lib/currencies';
import type { Metadata } from 'next';
import { GRAMS_PER_OZ } from '@/lib/conversions';

export const revalidate = 10800;

/**
 * Metadata carries the date the figures belong to.
 *
 * Search Console showed date-qualified queries ("gold price today september 2
 * spot gold usd ounce") being answered by /gold-price/2-september-2021 at
 * position 8 — 287 impressions, no clicks — while this page, the correct
 * answer, took none at all. The archive page won because its title contains
 * the date token and this page's title did not. Nobody clicks a five-year-old
 * archive page when they asked for today, so those impressions were dead on
 * arrival.
 *
 * The date comes from the snapshot, not the clock, so a stalled refresh
 * degrades the claim instead of overstating it. See utcDateOf.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { gold, updatedAt } = await getPrices();
  const date = utcDateOf(updatedAt);
  const dateText = date ? ` — ${formatLongDate(date)}` : '';
  const priceText = gold ? ` is ${formatCurrency(gold.price, 'USD')} per troy ounce.` : '.';

  const base = pageMetadata({
    title: `Gold Price Today${dateText}`,
    // Budgeted to stay under ~155 characters at the longest date ("30
    // September 2026") and a five-figure price, so the tail is never cut.
    description:
      `The gold price${date ? ` on ${formatLongDate(date)}` : ' today'}${priceText} ` +
      'Per gram, kilogram and tola rates in eight currencies, with the day range and change.',
    path: '/gold-price-today',
    keywords: [
      'gold price today',
      'gold rate today',
      'live gold price',
      'current gold price',
      'XAU USD',
    ],
  });

  /**
   * Declares /uk as this page's en-GB counterpart.
   *
   * Both answer "gold price today"; this one in dollars for a general
   * audience, /uk in sterling with hallmark purities for British searchers.
   * Without the pair being declared, Google sees two pages competing for one
   * intent rather than one cluster to route by region.
   */
  return {
    ...base,
    alternates: { ...base.alternates, languages: regionalEnglishAlternates() },
  };
}

export default async function GoldPriceTodayPage() {
  const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

  // Same date as the title, in the visible copy, so the page body backs up
  // what the title claims rather than leaving the date only in metadata.
  const date = utcDateOf(updatedAt);
  const subheading = date
    ? `The gold spot price on ${formatLongDate(date)}, per troy ounce, gram and kilogram, converted into eight currencies.`
    : 'The current gold spot price per troy ounce, gram and kilogram, converted into eight currencies.';

  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Gold price today', path: '/gold-price-today' }])} />
      <Breadcrumbs trail={[{ name: 'Gold price today', href: '/gold-price-today' }]} />

      <Hero
        goldData={gold}
        silverData={silver}
        updatedAt={updatedAt}
        heading="Gold Price Today"
        subheading={subheading}
        metal="XAU"
      />

      {/* Gold-first history so this page isn't a duplicate of the silver one. */}
      <LazyPriceChart
        lockMetal
        metal="gold"
        series={history.gold}
        source={history.source}
        title="Gold price history"
      />

      <MetalDataPanel
        series={history.gold}
        symbol="XAU"
        metalName="Gold"
        routeBase="/gold-price"
      />

      <section className="bg-zinc-900/30 py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-2xl font-bold text-white">Understanding the gold price</h2>
          <div className="grid gap-8 text-zinc-300 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xl font-semibold text-white">How gold is quoted</h3>
              <p className="mb-3">
                Gold trades in troy ounces, not the ounces used in a kitchen. One troy ounce is{' '}
                {GRAMS_PER_OZ} grams — about 10% heavier than an avoirdupois ounce, which is why a
                gram price is not simply the ounce price divided by 28.
              </p>
              <p>
                The quoted spot price is for pure (24K) gold. Jewellery is alloyed, so its melt value
                is the spot price multiplied by its purity — use the{' '}
                <Link href="/gold-price-calculator" className="text-gold-400 hover:text-gold-300">
                  gold calculator
                </Link>{' '}
                to work it out.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-xl font-semibold text-white">What moves the price</h3>
              <ul className="list-inside list-disc space-y-2">
                <li>Real interest rates — gold pays no yield, so rising rates weigh on it</li>
                <li>US dollar strength, since gold is priced in dollars</li>
                <li>Inflation expectations and currency debasement fears</li>
                <li>Central bank buying, a major source of demand</li>
                <li>Geopolitical stress, which drives safe-haven flows</li>
              </ul>
            </div>
          </div>
          <p className="mt-8 text-sm text-zinc-400">
            Looking at silver instead? See{' '}
            <Link href="/silver-price-today" className="text-gold-400 hover:text-gold-300">
              today&apos;s silver price
            </Link>
            , or browse{' '}
            <Link href="/gold-price-history" className="text-gold-400 hover:text-gold-300">
              longer-term gold history
            </Link>
            .
          </p>
        </div>
      </section>

      <NewsSection />

      <RelatedLinks
        links={relatedLinks('goldChart', 'calculator', 'goldForecast', 'perGram', 'goldUk', 'goldInsights')}
      />
    </>
  );
}
