import Link from 'next/link';

import { Hero } from '@/components/Hero';
import { PriceChart } from '@/components/PriceChart';
import { NewsSection } from '@/components/NewsSection';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices, getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { GRAMS_PER_OZ } from '@/lib/conversions';

export const metadata = pageMetadata({
  title: 'Gold Price Today',
  description:
    "Today's gold price per troy ounce, gram and kilogram in USD, EUR, GBP and more. Day range, change versus previous close and historical gold charts.",
  path: '/gold-price-today',
  keywords: ['gold price today', 'gold rate today', 'live gold price', 'current gold price', 'XAU USD'],
});

export default async function GoldPriceTodayPage() {
  const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Gold price today', path: '/gold-price-today' }])} />
      <Breadcrumbs trail={[{ name: 'Gold price today', href: '/gold-price-today' }]} />

      <Hero
        goldData={gold}
        silverData={silver}
        updatedAt={updatedAt}
        heading="Gold Price Today"
        subheading="The current gold spot price per troy ounce, gram and kilogram, converted into eight currencies."
      />

      {/* Gold-first history so this page isn't a duplicate of the silver one. */}
      <PriceChart
        gold={history.gold}
        silver={history.silver}
        source={history.source}
        defaultMetal="gold"
        lockMetal
        title="Gold price history"
      />

      <section className="bg-black py-12">
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
        links={relatedLinks('goldChart', 'calculator', 'history', 'silverToday', 'blog', 'news')}
      />
    </>
  );
}
