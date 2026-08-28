import { GoldCalculator } from '@/components/GoldCalculator';
import { LastUpdated } from '@/components/LastUpdated';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getPrices } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { KARAT_PURITY } from '@/lib/conversions';

export const metadata = pageMetadata({
  title: 'Gold Price Calculator',
  description:
    'Work out what your gold is worth by weight and karat. Enter ounces, grams or kilograms, pick 24K to 10K purity, and get the melt value in eight currencies.',
  path: '/gold-price-calculator',
  keywords: [
    'gold calculator',
    'gold value calculator',
    'scrap gold calculator',
    'karat gold calculator',
    'what is my gold worth',
  ],
});

const KARAT_GUIDE = [
  {
    karat: '24K' as const,
    title: 'Investment bullion',
    body: 'The purest form sold, used for bars and coins. Soft and deeply yellow, rarely used in jewellery that gets worn daily.',
  },
  {
    karat: '22K' as const,
    title: 'High-end jewellery',
    body: 'Common across South Asia and the Middle East. Retains most of the gold content while being durable enough to wear.',
  },
  {
    karat: '18K' as const,
    title: 'Fine jewellery and watches',
    body: 'The most common purity for quality Western jewellery. A good balance of colour, durability and cost.',
  },
  {
    karat: '14K' as const,
    title: 'Everyday jewellery',
    body: 'Popular in the United States. Harder and more scratch-resistant, at a lower price point.',
  },
];

export default async function GoldCalculatorPage() {
  const { gold, updatedAt } = await getPrices();

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: 'Gold price calculator', path: '/gold-price-calculator' }]),
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Gold Price Calculator',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Any',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
        ]}
      />

      <Breadcrumbs trail={[{ name: 'Gold price calculator', href: '/gold-price-calculator' }]} />

      <section className="bg-zinc-900/50 py-12">
        <div className="container mx-auto px-4">
          <h1 className="mb-6 text-center text-4xl font-bold text-white md:text-5xl">
            Gold Price Calculator
          </h1>
          <p className="mx-auto max-w-3xl text-center text-zinc-300">
            Find out what your gold is worth at current spot prices. Enter the weight, choose the
            karat purity, and the calculator returns the melt value in your selected currency.
          </p>
        </div>
      </section>

      <section className="bg-black py-12">
        <div className="container mx-auto px-4">
          {gold ? (
            <>
              <GoldCalculator goldPricePerOz={gold.price} />
              <div className="mt-6">
                <LastUpdated updatedAt={updatedAt} />
              </div>
            </>
          ) : (
            <p className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-zinc-900/50 p-6 text-center text-zinc-300">
              The calculator needs a current gold price and we couldn&apos;t load one. Please try
              again shortly.
            </p>
          )}
        </div>
      </section>

      <section className="bg-zinc-900/30 py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">How to use it</h2>
          <ol className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              ['Weigh your gold', 'Use a scale accurate to 0.1 g. Weigh each purity separately — mixing karats gives a wrong total.'],
              ['Select the karat', 'It is usually stamped on the piece (585 = 14K, 750 = 18K, 916 = 22K, 999 = 24K).'],
              ['Read the melt value', 'The result is the metal value at spot. Dealers pay a percentage of this, not the full amount.'],
            ].map(([title, body], index) => (
              <li key={title} className="text-center">
                <div className="mb-3 text-4xl font-bold text-gold-400">{index + 1}</div>
                <h3 className="mb-2 text-xl font-semibold text-white">{title}</h3>
                <p className="text-sm text-zinc-300">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-black py-12">
        <div className="container mx-auto px-4">
          <h2 className="mb-6 text-center text-2xl font-bold text-white">Understanding gold karats</h2>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {KARAT_GUIDE.map(({ karat, title, body }) => (
              <article key={karat} className="rounded-lg border border-white/10 p-6">
                <h3 className="mb-3 text-xl font-semibold text-gold-400">
                  {karat} gold ({(KARAT_PURITY[karat] * 100).toFixed(1)}% pure)
                </h3>
                <p className="mb-3 text-zinc-300">{body}</p>
                <p className="text-sm text-zinc-400">Best for: {title}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-4xl text-sm text-zinc-400">
            The calculator returns melt value — the worth of the metal itself. A buyer will offer
            less to cover refining, handling and margin, while a finished piece may be worth more
            than its melt value for its craftsmanship or brand.
          </p>
        </div>
      </section>

      <RelatedLinks
        links={relatedLinks('goldToday', 'scrapCalculator', 'meltValue', 'perGram', 'goldUk', 'goldChart')}
      />
    </>
  );
}
