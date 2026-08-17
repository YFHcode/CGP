import { GRAMS_PER_OZ, convertToGrams, type WeightUnit } from './conversions';

/**
 * Scrap gold valuation.
 *
 * Deliberately a different tool from the melt calculator, because it answers
 * a different question. "What is my gold worth" returns melt value — the
 * metal content at spot. "What will someone pay me for my scrap" returns
 * substantially less, and the gap between those two numbers is the single
 * thing a seller most needs to know before walking into a shop.
 *
 * Every figure here is melt value multiplied by a published-practice payout
 * band. Nothing is invented: the bands are wide on purpose, and shown as
 * ranges rather than a single number, because the honest answer genuinely is
 * a range that depends on the buyer, the quantity and the day.
 */

/**
 * Karat options for scrap, which are not the same set the bullion calculator
 * offers.
 *
 * 9K is included because it is the dominant scrap purity in the UK (hallmarked
 * 375) and the bullion calculator's list omits it. 24K is included only so
 * nobody is stuck, though pure gold arriving as "scrap" is unusual — that is
 * bullion, and it sells much closer to spot than anything here suggests.
 */
export type ScrapKarat = '9K' | '10K' | '14K' | '18K' | '21K' | '22K' | '24K';

export const SCRAP_KARATS: ScrapKarat[] = ['9K', '10K', '14K', '18K', '21K', '22K', '24K'];

/**
 * Purity as karat/24, matching KARAT_PURITY in conversions.ts.
 *
 * Note this is the karat fraction, not the hallmark figure: 14K is 14/24 =
 * 58.33%, while the UK/ISO hallmark for "14 carat" is stamped 585. Refiners
 * assay the actual metal, so the karat fraction is the right basis for an
 * estimate, and the difference is a fraction of a percent either way.
 */
export const SCRAP_KARAT_PURITY: Record<ScrapKarat, number> = {
    '9K': 9 / 24, // 37.5% — hallmarked 375, the common UK scrap standard
    '10K': 10 / 24, // 41.7% — common US scrap standard
    '14K': 14 / 24, // 58.3% — hallmarked 585
    '18K': 18 / 24, // 75.0% — hallmarked 750
    '21K': 21 / 24, // 87.5% — common in the Gulf
    '22K': 22 / 24, // 91.7% — hallmarked 916, common in South Asia
    '24K': 1, // pure; effectively bullion rather than scrap
};

export const SCRAP_KARAT_LABELS: Record<ScrapKarat, string> = {
    '9K': '9K (375)',
    '10K': '10K',
    '14K': '14K (585)',
    '18K': '18K (750)',
    '21K': '21K',
    '22K': '22K (916)',
    '24K': '24K (999)',
};

export interface ScrapBuyer {
    id: string;
    label: string;
    /** Fraction of melt value, low end. */
    low: number;
    /** Fraction of melt value, high end. */
    high: number;
    note: string;
}

/**
 * Typical payout as a fraction of melt value, by buyer type.
 *
 * These are wide bands rather than precise rates because the real figures
 * vary with quantity, karat mix, the refiner's assay fee and how much the
 * buyer wants the business that day. Quoting a single percentage would be
 * more satisfying to read and less true.
 *
 * Ordered best-paying first, which is also roughly least-convenient first —
 * that trade-off is the actual decision a seller is making.
 */
export const SCRAP_BUYERS: ScrapBuyer[] = [
    {
        id: 'refiner',
        label: 'Refiner (bulk lots)',
        low: 0.9,
        high: 0.95,
        note:
            'Pays closest to melt because it removes the middleman entirely, but usually sets a ' +
            'minimum quantity, charges an assay or lot fee, and settles days later rather than ' +
            'on the spot.',
    },
    {
        id: 'jeweller',
        label: 'Jeweller or coin shop',
        low: 0.75,
        high: 0.9,
        note:
            'The realistic option for most sellers. A local buyer who resells or refines in ' +
            'bulk can pay well, and the rate improves noticeably with quantity and with a ' +
            'competing quote in your pocket.',
    },
    {
        id: 'mail-in',
        label: 'Mail-in gold buyer',
        low: 0.5,
        high: 0.75,
        note:
            'Convenient and consistently the weakest rate. The offer arrives after you have ' +
            'already posted the gold, so check the return policy before sending anything you ' +
            'are not prepared to accept a low offer on.',
    },
    {
        id: 'pawn',
        label: 'Pawn shop',
        low: 0.4,
        high: 0.6,
        note:
            'Lowest of the four, because a pawn shop is pricing to resell at retail rather than ' +
            'to refine. Worth considering for a loan against the item, less so for an outright ' +
            'sale.',
    },
];

export interface ScrapValuation {
    /** Pure gold content in grams. */
    pureGrams: number;
    /** Full metal value at spot, before any dealer margin. */
    melt: number;
    /** Payout range for the selected buyer. */
    payoutLow: number;
    payoutHigh: number;
}

/**
 * Values a scrap lot. Returns zeros rather than NaN for empty or invalid
 * input so the UI can render a resting state without special-casing.
 */
export function valueScrapGold(
    spotPerOz: number,
    weight: number,
    unit: WeightUnit,
    karat: ScrapKarat,
    buyer: ScrapBuyer
): ScrapValuation {
    const empty = { pureGrams: 0, melt: 0, payoutLow: 0, payoutHigh: 0 };
    if (!Number.isFinite(spotPerOz) || spotPerOz <= 0) return empty;
    if (!Number.isFinite(weight) || weight <= 0) return empty;

    const grams = convertToGrams(weight, unit);
    const purity = SCRAP_KARAT_PURITY[karat] ?? 0;
    const pureGrams = grams * purity;
    const melt = (spotPerOz / GRAMS_PER_OZ) * pureGrams;

    return {
        pureGrams,
        melt,
        payoutLow: melt * buyer.low,
        payoutHigh: melt * buyer.high,
    };
}
