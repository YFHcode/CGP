// Weight conversions.
// A troy ounce is exactly 31.1034768 g by definition — the previous 31.1035
// rounded away real precision on kilo-scale valuations.
export const GRAMS_PER_OZ = 31.1034768;
export const GRAMS_PER_KG = 1000;

/**
 * Traditional South Asian weights, still the working units for a large share
 * of the world's physical gold trade.
 *
 * A tola is 180 troy grains (11.6638038 g) — the same weight sold as a
 * "bhori" or "vori" in Bangladesh and eastern India. A pavan (also savaran)
 * is exactly 8 g and is the unit most South Indian jewellery is priced in.
 */
export const GRAMS_PER_TOLA = 11.6638038;
export const GRAMS_PER_PAVAN = 8;

export type WeightUnit = 'oz' | 'gram' | 'kg';

export const WEIGHT_UNITS: WeightUnit[] = ['oz', 'gram', 'kg'];

export function convertToGrams(value: number, unit: WeightUnit): number {
    switch (unit) {
        case 'oz':
            return value * GRAMS_PER_OZ;
        case 'kg':
            return value * GRAMS_PER_KG;
        case 'gram':
        default:
            return value;
    }
}

export function convertFromGrams(grams: number, unit: WeightUnit): number {
    switch (unit) {
        case 'oz':
            return grams / GRAMS_PER_OZ;
        case 'kg':
            return grams / GRAMS_PER_KG;
        case 'gram':
        default:
            return grams;
    }
}

/**
 * Converts a per-troy-ounce price into a price per the requested unit.
 * Used everywhere a price is displayed, so the unit toggle and the calculator
 * can never drift apart.
 */
export function pricePerUnit(pricePerOz: number, unit: WeightUnit): number {
    if (!Number.isFinite(pricePerOz)) return Number.NaN;

    switch (unit) {
        case 'oz':
            return pricePerOz;
        case 'gram':
            return pricePerOz / GRAMS_PER_OZ;
        case 'kg':
            return (pricePerOz / GRAMS_PER_OZ) * GRAMS_PER_KG;
        default:
            return pricePerOz;
    }
}

// Karat to purity conversion.
export type Karat = '24K' | '22K' | '21K' | '18K' | '14K' | '10K';

export const KARATS: Karat[] = ['24K', '22K', '21K', '18K', '14K', '10K'];

/**
 * Purity as a fraction of pure gold (karat / 24).
 *
 * 24K is 1.0, not 0.999: spot price already *is* the price of pure gold, so
 * discounting it again understated every 24K valuation.
 */
export const KARAT_PURITY: Record<Karat, number> = {
    '24K': 1,
    '22K': 22 / 24, // 91.7%
    '21K': 21 / 24, // 87.5%
    '18K': 18 / 24, // 75.0%
    '14K': 14 / 24, // 58.3%
    '10K': 10 / 24, // 41.7%
};

export function calculateGoldValue(
    pricePerOz: number,
    weight: number,
    weightUnit: WeightUnit,
    karat: Karat
): number {
    if (!Number.isFinite(pricePerOz) || !Number.isFinite(weight) || weight <= 0) {
        return 0;
    }

    const weightInGrams = convertToGrams(weight, weightUnit);
    const pricePerGram = pricePerOz / GRAMS_PER_OZ;
    const purity = KARAT_PURITY[karat] ?? 1;

    return weightInGrams * pricePerGram * purity;
}

/**
 * The gold-to-silver ratio: how many ounces of silver buy one ounce of gold.
 * A genuinely useful figure traders watch, and computable from data we already
 * have — unlike the hardcoded "analysis" it replaces.
 */
export function goldSilverRatio(goldPerOz: number, silverPerOz: number): number {
    if (!Number.isFinite(goldPerOz) || !Number.isFinite(silverPerOz) || silverPerOz <= 0) {
        return Number.NaN;
    }
    return goldPerOz / silverPerOz;
}

/** Where the current price sits within the day's range, as a 0–100 percentage. */
export function positionInRange(price: number, low: number, high: number): number {
    if (![price, low, high].every(Number.isFinite) || high <= low) return Number.NaN;
    return ((price - low) / (high - low)) * 100;
}

/**
 * True when a quote carries a real day range, rather than the keyless
 * gold-api.com fallback's shape (see scripts/refresh-data.mjs), which sets
 * high_price === low_price === price rather than inventing a range when the
 * primary provider's quota is exhausted. Rendering that as "$X — $X" or a
 * flat 0.00% change reads as a broken market rather than the honest "we
 * don't know" it actually is — this is the shared check both price displays
 * use to hide the range/change UI instead.
 */
export function hasRangeData(data: { high_price: number; low_price: number }): boolean {
    return data.high_price !== data.low_price;
}

/**
 * Silver purity is expressed as fineness (parts per thousand), not karat.
 *
 * These are the stamps actually found on silver: .925 on sterling jewellery
 * and flatware, .900 on pre-1965 US "junk silver" coinage, .800 on much
 * continental European silver. A holder googling "what is my 925 silver
 * worth" is asking a purity question that no karat table answers.
 */
export type SilverFineness = '999' | '958' | '925' | '900' | '800';

export const SILVER_FINENESSES: SilverFineness[] = ['999', '958', '925', '900', '800'];

export const SILVER_PURITY: Record<SilverFineness, number> = {
    '999': 0.999, // fine silver — bullion bars and rounds
    '958': 0.958, // Britannia standard
    '925': 0.925, // sterling — most jewellery and flatware
    '900': 0.9, // coin silver, e.g. pre-1965 US dimes/quarters
    '800': 0.8, // common continental European standard
};

export const SILVER_FINENESS_LABELS: Record<SilverFineness, string> = {
    '999': 'Fine silver (.999)',
    '958': 'Britannia (.958)',
    '925': 'Sterling (.925)',
    '900': 'Coin silver (.900)',
    '800': 'Continental (.800)',
};

/**
 * UK gold hallmarking uses a millesimal fineness number stamped into the
 * metal — 375, 585, 750, 916, 999 — not the karat figure this site's other
 * gold pages quote. British jewellery is sold and priced by these marks, so
 * "what is 916 gold worth" and "9 carat gold price" are the same question in
 * two different vocabularies, and a page answering only in karat misses the
 * one most UK buyers actually search.
 *
 * These are the standards recognised under the UK Hallmarking Act 1973 and
 * struck by the four British Assay Offices (London, Birmingham, Sheffield,
 * Edinburgh); 990 is the mark used for some Britannia coinage and commemorative
 * pieces rather than everyday jewellery.
 */
export type GoldHallmark = '375' | '585' | '750' | '916' | '990' | '999';

export const GOLD_HALLMARKS: GoldHallmark[] = ['375', '585', '750', '916', '990', '999'];

export const GOLD_HALLMARK_PURITY: Record<GoldHallmark, number> = {
    '375': 0.375, // 9 carat — the most common British jewellery standard
    '585': 0.585, // 14 carat — less common in the UK than 9ct or 18ct
    '750': 0.75, // 18 carat
    '916': 0.916, // 22 carat — wedding rings, coins
    '990': 0.99, // 24 carat, commemorative/coin issues
    '999': 0.999, // 24 carat, fine gold bullion
};

export const GOLD_HALLMARK_LABELS: Record<GoldHallmark, string> = {
    '375': '375 (9 carat)',
    '585': '585 (14 carat)',
    '750': '750 (18 carat)',
    '916': '916 (22 carat)',
    '990': '990 (24 carat, commemorative)',
    '999': '999 (24 carat, fine gold)',
};
