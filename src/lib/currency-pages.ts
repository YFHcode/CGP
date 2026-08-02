import type { SupportedCurrency } from './currencies';

/**
 * Per-currency landing pages.
 *
 * Each carries genuinely local context — the units people actually buy in, the
 * market that matters, the way prices are quoted there — rather than the same
 * page with a different symbol. A page that only swapped the currency code
 * would be a doorway page; these answer different questions.
 */

export interface LocalUnit {
    name: string;
    grams: number;
    note: string;
}

export interface CurrencyPageConfig {
    currency: SupportedCurrency;
    /** URL segment, e.g. "inr". */
    slug: string;
    /** Country or region for the copy. */
    region: string;
    /** Demonym used in headings, e.g. "Indian". */
    adjective: string;
    /** Local weight units gold is commonly traded in. */
    localUnits: LocalUnit[];
    /** Two or three sentences of market context specific to this region. */
    context: string;
    /** Purities commonly quoted locally, as karat labels. */
    commonKarats: string[];
}

const TOLA_GRAMS = 11.6638038; // 3/8 troy ounce, the traditional South Asian tola

export const CURRENCY_PAGES: CurrencyPageConfig[] = [
    {
        currency: 'INR',
        slug: 'inr',
        region: 'India',
        adjective: 'Indian',
        localUnits: [
            { name: 'gram', grams: 1, note: 'the standard quoting unit for Indian jewellers' },
            { name: 'tola', grams: TOLA_GRAMS, note: 'traditional unit, still used for bars and coins' },
            { name: '10 grams', grams: 10, note: 'how Indian retail gold rates are usually published' },
        ],
        commonKarats: ['24K', '22K', '18K'],
        context:
            'India is one of the largest gold markets in the world, and demand is strongly seasonal — ' +
            'buying peaks around Dhanteras, Diwali and the wedding season. Retail rates are normally ' +
            'quoted per 10 grams rather than per ounce, and 22K is the usual purity for jewellery, ' +
            'so a local rate will sit below the 24K spot figure. Local prices also include import ' +
            'duty, GST and jeweller making charges, none of which are part of the international spot ' +
            'price shown here.',
    },
    {
        currency: 'EUR',
        slug: 'eur',
        region: 'the eurozone',
        adjective: 'European',
        localUnits: [
            { name: 'gram', grams: 1, note: 'common for small bars and jewellery' },
            { name: 'kilogram', grams: 1000, note: 'the standard institutional bar size' },
        ],
        commonKarats: ['24K', '18K', '14K'],
        context:
            'Euro gold prices move with both the metal and the EUR/USD exchange rate, so a rising ' +
            'dollar can lift the euro price even when the dollar price is flat. European retail ' +
            'investors typically buy 1 g to 1 kg bars and bullion coins, and in most EU states ' +
            'investment gold is exempt from VAT while silver is not.',
    },
    {
        currency: 'GBP',
        slug: 'gbp',
        region: 'the United Kingdom',
        adjective: 'British',
        localUnits: [
            { name: 'gram', grams: 1, note: 'used for small bars and scrap valuation' },
            { name: 'kilogram', grams: 1000, note: 'the standard bar size for larger holdings' },
        ],
        commonKarats: ['24K', '22K', '18K', '9K'],
        context:
            'London is the centre of the international gold market, and the LBMA price set there is ' +
            'the global benchmark. Sterling prices therefore reflect both the metal and the GBP/USD ' +
            'rate. UK-minted bullion coins such as Britannias and Sovereigns are free of capital ' +
            'gains tax for UK residents, which is why they often trade at a premium to plain bars.',
    },
    {
        currency: 'CAD',
        slug: 'cad',
        region: 'Canada',
        adjective: 'Canadian',
        localUnits: [
            { name: 'gram', grams: 1, note: 'used for jewellery and scrap' },
            { name: 'troy ounce', grams: 31.1034768, note: 'the standard for Maple Leaf coins' },
        ],
        commonKarats: ['24K', '18K', '14K', '10K'],
        context:
            'Canada is a major gold producer, and the Royal Canadian Mint’s Gold Maple Leaf is one ' +
            'of the most widely held bullion coins. Canadian dollar prices track the metal alongside ' +
            'the USD/CAD rate, which itself tends to move with commodity prices.',
    },
    {
        currency: 'AUD',
        slug: 'aud',
        region: 'Australia',
        adjective: 'Australian',
        localUnits: [
            { name: 'gram', grams: 1, note: 'used for jewellery and small bars' },
            { name: 'troy ounce', grams: 31.1034768, note: 'the standard for Perth Mint products' },
        ],
        commonKarats: ['24K', '18K', '9K'],
        context:
            'Australia is among the largest gold-mining nations, and the Perth Mint is a major ' +
            'refiner and bullion issuer. The Australian dollar is closely tied to commodity cycles, ' +
            'so AUD gold prices can behave quite differently from USD prices over the same period.',
    },
    {
        currency: 'JPY',
        slug: 'jpy',
        region: 'Japan',
        adjective: 'Japanese',
        localUnits: [
            { name: 'gram', grams: 1, note: 'the standard quoting unit in Japan' },
            { name: 'kilogram', grams: 1000, note: 'used for investment bars' },
        ],
        commonKarats: ['24K', '18K'],
        context:
            'Japanese gold is quoted per gram, and the yen price is heavily influenced by the ' +
            'USD/JPY rate — during periods of yen weakness the domestic gold price has reached ' +
            'records even when the dollar price has not. Consumption tax applies to purchases and ' +
            'is refundable on sale.',
    },
    {
        currency: 'CNY',
        slug: 'cny',
        region: 'China',
        adjective: 'Chinese',
        localUnits: [
            { name: 'gram', grams: 1, note: 'the standard quoting unit on the Shanghai Gold Exchange' },
            { name: 'kilogram', grams: 1000, note: 'the standard contract size for bars' },
        ],
        commonKarats: ['24K', '22K', '18K'],
        context:
            'China is the largest gold consumer and producer, and the Shanghai Gold Exchange quotes ' +
            'in yuan per gram. Domestic prices sometimes carry a premium or discount to the ' +
            'international price depending on local demand and import quotas. Buying is strongly ' +
            'seasonal around Chinese New Year.',
    },
];

export function findCurrencyPage(slug: string): CurrencyPageConfig | undefined {
    return CURRENCY_PAGES.find((page) => page.slug === slug.toLowerCase());
}
