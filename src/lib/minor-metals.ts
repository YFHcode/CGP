import type { MinorMetalSymbol } from '@/types';

/**
 * Platinum and palladium.
 *
 * These are deliberately not gold pages with a different symbol substituted.
 * The template-subtraction test — strip the variable fields from ten pages and
 * see whether what remains is identical — is the thing that decides whether a
 * page set survives, and a platinum page whose only distinguishing feature is
 * the word "platinum" fails it. So the content below is what is actually true
 * of each metal and false of the others: platinum is a 950-fineness jewellery
 * metal with a hydrogen story, palladium is an autocatalyst commodity with a
 * collapsed one, and neither has a karat system.
 */

export interface MinorMetal {
    symbol: MinorMetalSymbol;
    /** URL slug, e.g. "platinum-price". */
    slug: string;
    name: string;
    /** Lowercase, for mid-sentence use. */
    lower: string;
    /** Which chart palette entry to use. */
    chartMetal: 'platinum' | 'palladium';
    title: string;
    description: string;
    keywords: string[];
    /** One-paragraph summary shown under the heading. */
    intro: string;
    /** Fineness marks actually used for this metal, with their decimal purity. */
    purities: { mark: string; purity: number; note: string }[];
    /** Where demand comes from — the part that moves each price. */
    demand: { label: string; body: string }[];
    faq: { question: string; answer: string }[];
}

export const MINOR_METALS: Record<MinorMetalSymbol, MinorMetal> = {
    XPT: {
        symbol: 'XPT',
        slug: 'platinum-price',
        name: 'Platinum',
        lower: 'platinum',
        chartMetal: 'platinum',
        title: 'Platinum Price Today — Live Spot Price per Ounce and Gram',
        description:
            'Live platinum spot price per troy ounce, gram and kilogram, with historical charts, ' +
            '950 and 900 fineness values, and what drives platinum against gold.',
        keywords: [
            'platinum price',
            'platinum price today',
            'platinum price per gram',
            'platinum spot price',
            'platinum price per ounce',
            'platinum vs gold price',
        ],
        intro:
            'Platinum is rarer than gold in the ground but usually cheaper per ounce, because ' +
            'most of what is mined goes into industry rather than into vaults. Roughly three ' +
            'quarters of supply comes from South Africa and Russia, which makes the price ' +
            'unusually sensitive to power cuts, strikes and sanctions in a way gold is not.',
        purities: [
            {
                mark: '950',
                purity: 0.95,
                note: 'the standard for platinum jewellery in most markets',
            },
            { mark: '900', purity: 0.9, note: 'common in older and American pieces' },
            { mark: '850', purity: 0.85, note: 'usual for chain and lighter settings' },
            { mark: '999', purity: 0.999, note: 'investment bars and coins' },
        ],
        demand: [
            {
                label: 'Autocatalysts',
                body: 'Platinum scrubs emissions in diesel exhaust systems. Diesel’s retreat from European cars cut this badly, and it is the single clearest reason platinum spent years below gold.',
            },
            {
                label: 'Jewellery',
                body: 'A far larger share of demand than for palladium, concentrated in China, India and Japan — so platinum tracks Asian consumer demand more closely than industrial metals usually do.',
            },
            {
                label: 'Hydrogen',
                body: 'Electrolysers and fuel cells use platinum as a catalyst. This is the growth story attached to the metal, and it is genuinely early rather than priced in.',
            },
        ],
        faq: [
            {
                question: 'Why is platinum cheaper than gold if it is rarer?',
                answer:
                    'Rarity sets supply, not price. Almost all gold ever mined still exists and is held as a store of value, so demand is investment-led and deep. Platinum is consumed by industry, mostly in vehicle exhaust systems, so its price follows the car market and the industrial cycle. When diesel demand fell, so did platinum — regardless of how little of it comes out of the ground.',
            },
            {
                question: 'What is 950 platinum worth?',
                answer:
                    'Platinum does not use karats. Jewellery is marked by fineness instead: 950 means 95% pure, 900 means 90%. Multiply the spot price per gram by the fineness to get the metal value — 950 platinum is worth 95% of the pure figure. That is the melt value before any dealer margin or fabrication cost.',
            },
            {
                question: 'Is platinum a good hedge like gold?',
                answer:
                    'Not in the same way. Gold rises in crises because people buy it as a safe haven. Platinum usually falls in a downturn, because a recession means fewer cars and less industrial activity. It behaves closer to an industrial commodity than to a monetary metal, which is worth knowing before treating the two as interchangeable.',
            },
            {
                question: 'What is the platinum to gold ratio?',
                answer:
                    'How many ounces of platinum one ounce of gold buys. It sat below 1 for most of the twentieth century — platinum was the premium metal — and moved above 1 after 2015, meaning gold became worth more than platinum. Traders watch it as a measure of whether platinum is cheap relative to gold rather than cheap outright.',
            },
        ],
    },

    XPD: {
        symbol: 'XPD',
        slug: 'palladium-price',
        name: 'Palladium',
        lower: 'palladium',
        chartMetal: 'palladium',
        title: 'Palladium Price Today — Live Spot Price per Ounce and Gram',
        description:
            'Live palladium spot price per troy ounce, gram and kilogram, with historical charts ' +
            'and why palladium rose above gold and then fell back.',
        keywords: [
            'palladium price',
            'palladium price today',
            'palladium price per gram',
            'palladium spot price',
            'palladium price per ounce',
            'palladium vs platinum',
        ],
        intro:
            'Palladium is the most industrial of the precious metals: the overwhelming majority ' +
            'goes into catalytic converters for petrol engines. That single use makes it the ' +
            'most volatile of the four — it traded above gold between 2018 and 2022 on a genuine ' +
            'supply shortage, then fell hard as carmakers substituted platinum and electric ' +
            'vehicles began removing the need for a converter at all.',
        purities: [
            { mark: '999', purity: 0.999, note: 'investment bars and coins' },
            { mark: '950', purity: 0.95, note: 'the mark used for the little palladium jewellery made' },
        ],
        demand: [
            {
                label: 'Autocatalysts',
                body: 'The dominant use by a wide margin. Palladium’s price is, more than anything else, a bet on how many petrol cars get built — which is why it is falling as electrification advances.',
            },
            {
                label: 'Substitution risk',
                body: 'Platinum and palladium are chemically interchangeable in many converters. When palladium ran far above platinum, manufacturers re-engineered to use platinum instead, and that switch does not reverse quickly.',
            },
            {
                label: 'Concentrated supply',
                body: 'Russia and South Africa produce most of the world’s palladium, much of it as a by-product of nickel and platinum mining. By-product supply does not respond to price, which is why shortages persist and then break violently.',
            },
        ],
        faq: [
            {
                question: 'Why did palladium become more expensive than gold?',
                answer:
                    'Tightening emissions rules through the 2010s raised how much palladium each petrol car needed, at a time when supply was fixed — most palladium is a by-product of nickel and platinum mining, so producers could not simply mine more of it. The resulting shortage pushed it above gold from 2018, peaking near $3,000 an ounce in 2022.',
            },
            {
                question: 'Why has the palladium price fallen so far?',
                answer:
                    'Two things at once. Carmakers redesigned converters to substitute cheaper platinum, permanently removing part of the demand; and electric vehicles do not use a catalytic converter at all. A metal whose demand is concentrated in one application falls hard when that application shrinks.',
            },
            {
                question: 'Is palladium worth investing in?',
                answer:
                    'It is the most volatile of the four precious metals and the most exposed to a single industry that is actively shrinking. That cuts both ways: the same concentration that drove it above gold can drive it back. Nothing here is financial advice — it is a commodity bet on internal combustion engines, not a store of value.',
            },
            {
                question: 'How much palladium is in a catalytic converter?',
                answer:
                    'Typically two to seven grams, varying widely by vehicle size, age and emissions standard. That is why scrap converters have resale value and why converter theft rose alongside the price. Recyclers pay on assay of the specific unit, not on a spot calculation.',
            },
        ],
    },
};

export const MINOR_METAL_LIST = Object.values(MINOR_METALS);

/** Slug lookup for the route. */
export function minorMetalBySlug(slug: string): MinorMetal | null {
    return MINOR_METAL_LIST.find((m) => m.slug === slug) ?? null;
}
