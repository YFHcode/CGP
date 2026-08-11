import { Hero } from '@/components/Hero';
import { LazyExploreChart } from '@/components/LazyExploreChart';
import { NewsSection } from '@/components/NewsSection';
import { AnalysisSection } from '@/components/AnalysisSection';
import { GoldCalculator } from '@/components/GoldCalculator';
import { JsonLd } from '@/components/JsonLd';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices, getHistory } from '@/lib/prices';
import { faqSchema, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Gold & Silver Prices Today — Live Charts and Calculator',
  description:
    'Track gold and silver spot prices in USD, EUR, GBP, JPY, INR and more. Historical charts, gold-to-silver ratio and a karat-aware value calculator.',
  path: '/',
  keywords: [
    'gold price',
    'silver price',
    'gold chart',
    'gold value calculator',
    'XAU USD',
    'XAG USD',
    'gold silver ratio',
  ],
});

export default async function Home() {
  const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

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
        subheading="Spot prices in eight currencies, with historical charts, the gold-to-silver ratio and a karat value calculator."
      />

      <LazyExploreChart
        gold={history.gold}
        silver={history.silver}
        source={history.source}
      />

      <AnalysisSection gold={gold} silver={silver} />

      {gold && (
        <section className="bg-black py-12">
          <div className="container mx-auto px-4">
            <GoldCalculator goldPricePerOz={gold.price} />
          </div>
        </section>
      )}

      <NewsSection />

      <RelatedLinks
        title="Prices, charts and tools"
        links={relatedLinks(
          'goldToday',
          'silverToday',
          'calculator',
          'history',
          'goldChart',
          'goldInsights'
        )}
      />
    </>
  );
}
