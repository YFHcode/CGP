import { GRAMS_PER_OZ, GRAMS_PER_KG, GRAMS_PER_TOLA, GRAMS_PER_PAVAN } from './conversions';

/**
 * Per-unit landing pages.
 *
 * Each targets a different buyer with different context — gram pages are read
 * by people valuing jewellery, ounce pages by bullion buyers, kilo pages by
 * larger investors — so they carry distinct copy rather than one template with
 * the unit swapped.
 */
export interface UnitPageConfig {
    slug: string;
    unit: string;
    grams: number;
    heading: string;
    intro: string;
    audience: string;
    context: string;
}

export const UNIT_PAGES: UnitPageConfig[] = [
    {
        slug: 'gram',
        unit: 'gram',
        grams: 1,
        heading: 'per Gram',
        audience: 'jewellery and scrap',
        intro:
            'The gram price is what most jewellers and scrap buyers quote from, and it is the ' +
            'figure you need when valuing a chain, ring or a bag of mixed pieces.',
        context:
            'A gram price is derived from the international spot price by dividing by 31.1034768, ' +
            'the number of grams in a troy ounce. Note that jewellery is almost never pure: an 18K ' +
            'piece is 75% gold, so its melt value is 75% of the pure gram price. Buyers then pay a ' +
            'percentage of melt value, not the full amount, to cover refining and margin.',
    },
    {
        slug: 'ounce',
        unit: 'troy ounce',
        grams: GRAMS_PER_OZ,
        heading: 'per Ounce',
        audience: 'bullion and investment',
        intro:
            'The troy ounce is the unit the international market quotes in, and the one bullion ' +
            'coins and bars are usually sold by.',
        context:
            'A troy ounce is 31.1034768 grams — about 10% heavier than the avoirdupois ounce used ' +
            'for food, which is 28.35 g. Confusing the two overstates or understates a holding by ' +
            'roughly a tenth. Bullion coins such as the Krugerrand, Eagle, Maple Leaf and Britannia ' +
            'are all built around the one-ounce standard, and dealers charge a premium over spot ' +
            'that covers minting and distribution.',
    },
    {
        slug: 'kilo',
        unit: 'kilogram',
        grams: GRAMS_PER_KG,
        heading: 'per Kilo',
        audience: 'large bars and institutional holdings',
        intro:
            'The kilobar is the standard unit for larger private holdings and for much of the Asian ' +
            'wholesale market.',
        context:
            'A kilogram is 32.1507 troy ounces. Kilobars carry the lowest premium over spot of any ' +
            'retail format, which is why they suit larger purchases, but they are correspondingly ' +
            'harder to sell in part. The 400 oz Good Delivery bar used by central banks and the ' +
            'London market is roughly 12.4 kg.',
    },
    {
        // 180 troy grains. Still the working unit across the Indian
        // subcontinent and much of the Gulf, where a large share of the
        // world's physical gold actually changes hands — and a unit no
        // ounce-or-gram page answers for.
        slug: 'tola',
        unit: 'tola',
        grams: GRAMS_PER_TOLA,
        heading: 'per Tola',
        audience: 'buyers in India, Pakistan, Bangladesh and the Gulf',
        intro:
            'The tola is the traditional unit of the Indian subcontinent, still quoted daily by ' +
            'jewellers in India, Pakistan, Bangladesh, Nepal and much of the Gulf.',
        context:
            'One tola is 11.6638 grams — historically 180 troy grains, and still the unit families ' +
            'use for weddings, inheritance and gold-loan pledging even though grams are the ' +
            'official trade standard. The same weight is called a bhori (or vori) in Bangladesh ' +
            'and eastern India, so a "1 bhori gold price" is the same figure as a tola price. ' +
            'Jewellery is rarely pure: a 22K tola holds 91.7% of the pure value shown here, and ' +
            '18K holds 75%.',
    },
    {
        // Genuinely a different weight from the tola (8 g vs 11.66 g), so it
        // earns its own page rather than being a second name for one number.
        slug: 'pavan',
        unit: 'pavan',
        grams: GRAMS_PER_PAVAN,
        heading: 'per Pavan',
        audience: 'buyers in Kerala, Tamil Nadu and southern India',
        intro:
            'The pavan is the unit jewellers quote in across Kerala and Tamil Nadu, and the one ' +
            'most South Indian wedding purchases are actually priced in.',
        context:
            'One pavan is exactly 8 grams, so a pavan rate is simply the gram rate multiplied by ' +
            'eight. It is also called a savaran, and sometimes an "sovereign" locally — not to be ' +
            'confused with the British gold sovereign coin, which contains about 7.32 g of pure ' +
            'gold. Because most South Indian jewellery is sold as 22K, the practical figure a ' +
            'buyer pays is 91.7% of the pure pavan value shown here, plus making charges.',
    },
];

export function findUnitPage(slug: string): UnitPageConfig | undefined {
    return UNIT_PAGES.find((page) => page.slug === slug.toLowerCase());
}
