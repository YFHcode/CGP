import { GRAMS_PER_OZ, GRAMS_PER_KG } from './conversions';

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
];

export function findUnitPage(slug: string): UnitPageConfig | undefined {
    return UNIT_PAGES.find((page) => page.slug === slug.toLowerCase());
}
