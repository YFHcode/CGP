import Link from 'next/link';

import { Hero } from '@/components/Hero';
import { LazyPriceChart } from '@/components/LazyPriceChart';
import { NewsSection } from '@/components/NewsSection';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices, getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Silver Price Today',
  description:
    "Today's silver price per troy ounce, gram and kilogram in USD, EUR, GBP and more. Day range, gold-to-silver ratio and historical silver charts.",
  path: '/silver-price-today',
  keywords: ['silver price today', 'silver rate today', 'live silver price', 'XAG USD', 'silver spot price'],
});

export default async function SilverPriceTodayPage() {
  const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Silver price today', path: '/silver-price-today' }])} />
      <Breadcrumbs trail={[{ name: 'Silver price today', href: '/silver-price-today' }]} />

      <Hero
        goldData={gold}
        silverData={silver}
        updatedAt={updatedAt}
        heading="Silver Price Today"
        subheading="The current silver spot price per troy ounce, gram and kilogram, converted into eight currencies."
      />

      {/* Silver-first, and locked, so this page leads with its own metal. */}
      <LazyPriceChart
        gold={history.gold}
        silver={history.silver}
        source={history.source}
        defaultMetal="silver"
        lockMetal
        title="Silver price history"
      />

      <section className="bg-black py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-2xl font-bold text-white">Understanding the silver price</h2>
          <div className="grid gap-8 text-zinc-300 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xl font-semibold text-white">Why silver moves differently</h3>
              <p className="mb-3">
                Roughly half of silver demand is industrial — solar panels, electronics and brazing
                alloys — so silver tracks the economic cycle as well as safe-haven flows. That dual
                role makes it noticeably more volatile than gold.
              </p>
              <p>
                The gold-to-silver ratio on our{' '}
                <Link href="/" className="text-gold-400 hover:text-gold-300">
                  dashboard
                </Link>{' '}
                shows how many ounces of silver buy one ounce of gold, a common way to judge relative
                value between the two.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-xl font-semibold text-white">What moves the price</h3>
              <ul className="list-inside list-disc space-y-2">
                <li>Industrial demand, especially photovoltaics and electronics</li>
                <li>Mine supply, much of it a by-product of copper and lead mining</li>
                <li>Investment flows into bars, coins and ETFs</li>
                <li>The gold-to-silver ratio and relative-value trading</li>
                <li>Global growth expectations</li>
              </ul>
            </div>
          </div>
          <p className="mt-8 text-sm text-zinc-400">
            Prefer gold? See{' '}
            <Link href="/gold-price-today" className="text-gold-400 hover:text-gold-300">
              today&apos;s gold price
            </Link>
            .
          </p>
        </div>
      </section>

      <NewsSection />

      <RelatedLinks
        links={relatedLinks('silverChart', 'goldToday', 'calculator', 'history', 'goldChart', 'news')}
      />
    </>
  );
}
