// Weight conversions.
// A troy ounce is exactly 31.1034768 g by definition — the previous 31.1035
// rounded away real precision on kilo-scale valuations.
export const GRAMS_PER_OZ = 31.1034768;
export const GRAMS_PER_KG = 1000;

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
