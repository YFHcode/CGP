import type { Metadata } from 'next';
import Link from 'next/link';
import { Calendar } from 'lucide-react';

import { LazyPriceChart } from '@/components/LazyPriceChart';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getHistory } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { localeAlternates } from '@/lib/locale-pages';

const baseMetadata = pageMetadata({
  title: 'Gold Price History',
  description:
    'Historical gold prices with interactive charts over one week, one month, six months and one year. Track how gold has moved and compare it with silver.',
  path: '/gold-price-history',
  keywords: ['gold price history', 'historical gold prices', 'gold price chart history', 'gold price trends'],
});

// Reciprocal hreflang back to the /uk and /de locale pages, which are this
// page's localized counterparts — without this, only they pointed at the
// English original, and Google discounts one-way hreflang.
export const metadata: Metadata = {
  ...baseMetadata,
  alternates: {
    ...baseMetadata.alternates,
    languages: localeAlternates('/gold-price-history'),
  },
};

const MILESTONES = [
  {
    period: '2020',
    title: 'Pandemic-era record',
    body: 'Gold passed $2,070 an ounce during the COVID-19 crisis as real yields fell and investors moved into safe-haven assets.',
  },
  {
    period: '2011',
    title: 'Post-crisis peak',
    body: 'Gold reached about $1,920 an ounce following the financial crisis, amid quantitative easing and the euro-zone debt crisis.',
  },
  {
    period: '2001–2011',
    title: 'Decade-long bull market',
    body: 'Gold rose from roughly $250 to nearly $1,900 an ounce over ten years, one of its longest sustained advances.',
  },
  {
    period: '1980',
    title: 'Inflation-era spike',
    body: 'Gold briefly touched $850 an ounce during double-digit inflation and geopolitical tension — worth well over $2,500 in today’s money.',
  },
];

export default async function GoldPriceHistoryPage() {
  const history = await getHistory();

  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Gold price history', path: '/gold-price-history' }])} />
      <Breadcrumbs trail={[{ name: 'Gold price history', href: '/gold-price-history' }]} />

      <section className="bg-zinc-900/50 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Calendar className="h-8 w-8 text-gold-400" aria-hidden="true" />
            <h1 className="text-4xl font-bold text-white md:text-5xl">Gold Price History</h1>
          </div>
          <p className="mx-auto max-w-3xl text-center text-zinc-300">
            Daily closing prices for gold and silver over the past week, month, six months and year.
            Switch metals and currencies to compare how each has moved.
          </p>
        </div>
      </section>

      <LazyPriceChart
        gold={history.gold}
        silver={history.silver}
        source={history.source}
        title="Historical closing prices"
      />

      <section className="bg-black py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            Notable moments in gold&apos;s price history
          </h2>
          <div className="mx-auto max-w-4xl space-y-4">
            {MILESTONES.map(({ period, title, body }) => (
              <article key={period} className="border-l-4 border-gold-500 py-3 pl-6">
                <h3 className="text-lg font-semibold text-white">
                  {period} — {title}
                </h3>
                <p className="text-zinc-300">{body}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-4xl text-sm text-zinc-400">
            Historical milestones are approximate nominal figures included for context. Past
            performance says nothing about future prices. For the current market, see{' '}
            <Link href="/gold-price-today" className="text-gold-400 hover:text-gold-300">
              today&apos;s gold price
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="bg-zinc-900/30 py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">
            Why historical prices are useful
          </h2>
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {[
              ['Spot long-term trends', 'Multi-year data reveals sustained direction that a single day of movement hides entirely.'],
              ['Understand volatility', 'Seeing how far gold has fallen in past drawdowns sets realistic expectations for risk.'],
              ['Compare with silver', 'Switching metals on the chart shows how differently the two behave through the same period.'],
            ].map(([title, body]) => (
              <article key={title} className="rounded-lg border border-white/10 p-6 text-center">
                <h3 className="mb-3 text-xl font-semibold text-gold-400">{title}</h3>
                <p className="text-sm text-zinc-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <RelatedLinks
        links={relatedLinks('goldArchive', 'silverArchive', 'goldToday', 'goldChart', 'calculator', 'goldInsights')}
      />
    </>
  );
}
