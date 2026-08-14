import { GRAMS_PER_OZ } from './conversions';

/**
 * Coin melt values.
 *
 * This is the one large search category the site had no pages for at all:
 * "silver quarter value", "junk silver calculator", "krugerrand price today",
 * "gold sovereign value". Coins were previously mentioned only in passing
 * inside the per-unit prose.
 *
 * Every figure below is a published mint specification, and melt value is
 * derived from them rather than stored, so a coin's stated purity and its
 * quoted value can never drift apart.
 *
 * IMPORTANT: melt value is the metal content only. For circulating US silver
 * especially, key dates and mintmarks are worth many multiples of melt to a
 * collector, so `numismaticWarning` carries a per-coin caution. Telling
 * someone a 1916-D dime is "worth $2" would be actively harmful, and the
 * warning is rendered prominently rather than buried in a footnote.
 */

export type CoinMetal = 'gold' | 'silver';

/**
 * Grouping drives both the index page's sections and the junk-silver
 * calculator, which only accepts the US circulating denominations that are
 * actually sold by face value.
 */
export type CoinCategory = 'us-silver' | 'silver-bullion' | 'gold-bullion';

export interface Coin {
    slug: string;
    name: string;
    metal: CoinMetal;
    category: CoinCategory;
    /** Total struck weight in grams, per the issuing mint's specification. */
    grossGrams: number;
    /** Purity as a decimal fraction (0.900 = 90% fine). */
    fineness: number;
    country: string;
    years: string;
    /** Face value, where the coin circulated as money. */
    faceValue?: string;
    intro: string;
    context: string;
    /** Set when key dates routinely sell far above metal content. */
    numismaticWarning?: string;
}

/**
 * Renders a purity the way the trade writes it: ".900", ".999", ".9167".
 *
 * Fineness is quoted as parts per thousand, so a naive toString gives "0.9"
 * for 90% silver — arithmetically correct but not a notation anyone stamping
 * or buying metal would recognise. Minimum three decimals, up to four where
 * the extra digit is real (.9167 for 22 karat, .9999 for four-nines).
 */
export function formatFineness(fineness: number): string {
    const trimmed = fineness.toFixed(4).replace(/0+$/, '');
    const [, decimals = ''] = trimmed.split('.');
    return fineness.toFixed(Math.max(3, decimals.length)).replace(/^0/, '');
}

/**
 * The same purity as a percentage, exact and without trailing zeros:
 * 90%, 35%, 99.9%, 99.99%, 91.67%.
 *
 * A fixed decimal count cannot serve this set — one decimal rounds 22 karat's
 * 91.67% to a wrong-looking 91.7%, while two pads 90% into "90.00%".
 */
export function formatPurityPercent(fineness: number): string {
    return `${(fineness * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

/** Pure metal content in grams. Derived, never stored. */
export function pureGrams(coin: Coin): number {
    return coin.grossGrams * coin.fineness;
}

/** Pure metal content in troy ounces — the "ASW/AGW" figure dealers quote. */
export function pureTroyOz(coin: Coin): number {
    return pureGrams(coin) / GRAMS_PER_OZ;
}

/** Melt value of one coin at the given spot price per troy ounce. */
export function meltValue(coin: Coin, spotPerOz: number): number {
    if (!Number.isFinite(spotPerOz)) return Number.NaN;
    return pureTroyOz(coin) * spotPerOz;
}

/**
 * Silver in one dollar of face value of US 90% coinage, in troy ounces.
 *
 * The arithmetic gives 0.7234 ozt — ten dimes, four quarters and two halves
 * all contain exactly 22.5 g of silver by design. The trade nonetheless
 * prices circulated bags at 0.715, because decades in circulation wore
 * roughly 1% of the metal off. Both numbers are correct for different
 * material, so both are exposed rather than silently picking one.
 */
export const ASW_PER_DOLLAR_FACE_UNCIRCULATED = 22.5 / GRAMS_PER_OZ;
export const ASW_PER_DOLLAR_FACE_CIRCULATED = 0.715;

export const COINS: Coin[] = [
    // -----------------------------------------------------------------------
    // US circulating silver — "junk silver". Highest search volume by far.
    // -----------------------------------------------------------------------
    {
        slug: 'silver-dime',
        name: 'Silver Dime (Mercury / Roosevelt)',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 2.5,
        fineness: 0.9,
        country: 'United States',
        years: '1916–1945 (Mercury), 1946–1964 (Roosevelt)',
        faceValue: '10¢',
        intro:
            'Every US dime struck in 1964 or earlier is 90% silver. Dimes dated 1965 and later ' +
            'are copper-nickel and contain no silver at all.',
        context:
            'The quickest way to sort a jar of dimes is by date and edge: a silver dime has a ' +
            'solid silver-white edge, while a clad dime shows a copper stripe. Mercury and ' +
            'Roosevelt dimes share identical specifications — 2.5 g at .900 fine — so a mixed ' +
            'pile can be counted together. Ten dimes make one dollar of face value.',
        numismaticWarning:
            'Check the date and mintmark before selling for melt. A 1916-D Mercury dime is worth ' +
            'thousands of dollars to a collector, and the 1942/1 overdate several hundred — many ' +
            'multiples of its silver content.',
    },
    {
        slug: 'silver-quarter',
        name: 'Silver Quarter (Washington)',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 6.25,
        fineness: 0.9,
        country: 'United States',
        years: '1932–1964',
        faceValue: '25¢',
        intro:
            'Washington quarters dated 1964 and earlier are 90% silver. From 1965 the composition ' +
            'changed to copper-nickel clad, which is worth face value only.',
        context:
            'The 1965 cutoff is the single thing worth knowing: the design did not change, only ' +
            'the metal, so date is the only reliable tell short of weighing the coin. A silver ' +
            'quarter weighs 6.25 g against 5.67 g for a clad one, and rings noticeably higher when ' +
            'dropped. Four quarters make one dollar of face value.',
        numismaticWarning:
            'The 1932-D and 1932-S are scarce key dates worth well above melt in any condition. ' +
            'Check the date before selling a quarter for its silver.',
    },
    {
        slug: 'silver-half-dollar',
        name: 'Silver Half Dollar (Walking Liberty / Franklin / 1964 Kennedy)',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 12.5,
        fineness: 0.9,
        country: 'United States',
        years: '1916–1947 (Walking Liberty), 1948–1963 (Franklin), 1964 (Kennedy)',
        faceValue: '50¢',
        intro:
            'Half dollars dated 1964 or earlier are 90% silver. The 1964 Kennedy is the last of ' +
            'them — 1965 to 1970 Kennedys are a reduced 40% silver, and 1971 onwards contain none.',
        context:
            'The half dollar is the denomination where the date matters most, because there are ' +
            'three separate compositions in seven years. 1964 and earlier is 90% silver; 1965–1970 ' +
            'is 40%; 1971 and later is copper-nickel clad and worth face value. Two 90% halves make ' +
            'one dollar of face value.',
        numismaticWarning:
            'Early Walking Liberty halves — particularly 1916-S, 1921, 1921-D and 1921-S — carry ' +
            'substantial collector premiums over their silver content.',
    },
    {
        slug: 'kennedy-half-dollar-40-percent',
        name: '40% Silver Kennedy Half Dollar',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 11.5,
        fineness: 0.4,
        country: 'United States',
        years: '1965–1970',
        faceValue: '50¢',
        intro:
            'Kennedy half dollars struck from 1965 to 1970 are 40% silver — a transitional ' +
            'composition often missed by people who only check for the 1964 cutoff.',
        context:
            'These are the coins most often thrown back in the jar by mistake. The outer layers ' +
            'are 80% silver over a 20% silver core, averaging 40% overall, so each coin holds ' +
            'about a third of the silver in a 1964 half. They are worth well above face value but ' +
            'notably less than 90% coinage, and dealers price them as a separate category rather ' +
            'than mixing them into 90% bags.',
    },
    {
        slug: 'morgan-silver-dollar',
        name: 'Morgan Silver Dollar',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 26.73,
        fineness: 0.9,
        country: 'United States',
        years: '1878–1904, 1921',
        faceValue: '$1',
        intro:
            'The Morgan dollar is the classic US silver dollar — 26.73 g at 90% fine, containing ' +
            'about three-quarters of a troy ounce of silver.',
        context:
            'Morgans are the coin where melt value is least likely to be the right number. They ' +
            'were struck in enormous quantities, sat in Treasury vaults for decades, and survive ' +
            'in high grade far more often than other 19th-century coinage — so condition and ' +
            'mintmark drive the price far more than the silver does.',
        numismaticWarning:
            'Melt value is usually the floor, not the price. Common-date circulated Morgans trade ' +
            'above melt, and key dates such as 1889-CC, 1893-S and 1895 are worth thousands. Have ' +
            'any Morgan identified before selling it as scrap.',
    },
    {
        slug: 'peace-silver-dollar',
        name: 'Peace Silver Dollar',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 26.73,
        fineness: 0.9,
        country: 'United States',
        years: '1921–1928, 1934–1935',
        faceValue: '$1',
        intro:
            'The Peace dollar replaced the Morgan in 1921 and shares its exact specifications — ' +
            '26.73 g at .900 fine — so the two carry identical silver content.',
        context:
            'Struck to mark the end of the First World War, the Peace dollar ran in two blocks ' +
            'either side of a nine-year gap. Because the weight and fineness match the Morgan, ' +
            'the two are interchangeable for melt purposes and dealers usually quote them together.',
        numismaticWarning:
            'The 1928 Philadelphia issue and the 1934-S are the key dates, both worth many times ' +
            'melt. The high-relief 1921 also carries a strong premium.',
    },
    {
        slug: 'silver-war-nickel',
        name: 'Silver War Nickel',
        metal: 'silver',
        category: 'us-silver',
        grossGrams: 5,
        fineness: 0.35,
        country: 'United States',
        years: '1942–1945',
        faceValue: '5¢',
        intro:
            'Jefferson nickels struck from mid-1942 through 1945 contain 35% silver — nickel was ' +
            'diverted to the war effort, so the mint substituted silver and manganese.',
        context:
            'War nickels are identified by a large mintmark (P, D or S) above Monticello on the ' +
            'reverse — the only US coins to carry a P mintmark before 1979, and the only Jefferson ' +
            'nickels with a mintmark on that side at all. Every other Jefferson nickel, before or ' +
            'after, contains no silver. They are easy to spot once you know where to look and are ' +
            'routinely missed in inherited collections.',
    },

    // -----------------------------------------------------------------------
    // Modern silver bullion.
    // -----------------------------------------------------------------------
    {
        slug: 'american-silver-eagle',
        name: 'American Silver Eagle',
        metal: 'silver',
        category: 'silver-bullion',
        grossGrams: 31.103,
        fineness: 0.999,
        country: 'United States',
        years: '1986–present',
        faceValue: '$1',
        intro:
            'The American Silver Eagle is the US Mint’s official bullion coin — one troy ounce of ' +
            '.999 fine silver, and the most widely traded silver coin in the world.',
        context:
            'Eagles carry a higher premium over spot than generic rounds or bars, because they are ' +
            'government-guaranteed for weight and purity and are the default coin for IRA-eligible ' +
            'silver. That premium is real money on the way in and usually recoverable on the way ' +
            'out, so an Eagle is worth more than its melt value in practice — melt is the floor.',
    },
    {
        slug: 'canadian-silver-maple-leaf',
        name: 'Canadian Silver Maple Leaf',
        metal: 'silver',
        category: 'silver-bullion',
        grossGrams: 31.103,
        fineness: 0.9999,
        country: 'Canada',
        years: '1988–present',
        faceValue: 'C$5',
        intro:
            'The Silver Maple Leaf is .9999 fine — a step purer than the American Eagle, and among ' +
            'the purest silver bullion coins produced anywhere.',
        context:
            'The Royal Canadian Mint moved the Maple to four-nines purity in 1988 and has added ' +
            'radial lines and a micro-engraved laser mark as anti-counterfeiting features. The ' +
            'extra purity makes almost no difference to melt value — the gap between .999 and ' +
            '.9999 is a tenth of a percent — but it does make the coin marginally softer and more ' +
            'prone to milk spots and handling marks.',
    },
    {
        slug: 'silver-britannia',
        name: 'Silver Britannia',
        metal: 'silver',
        category: 'silver-bullion',
        grossGrams: 31.103,
        fineness: 0.999,
        country: 'United Kingdom',
        years: '1997–present (.958 until 2012, .999 from 2013)',
        faceValue: '£2',
        intro:
            'The Silver Britannia is the Royal Mint’s bullion coin — one troy ounce, .999 fine ' +
            'since 2013, and free of UK capital gains tax for British residents.',
        context:
            'Britannias struck between 1997 and 2012 are Britannia silver standard, .958 fine, ' +
            'rather than .999 — so an older coin holds about 4% less silver than a modern one of ' +
            'the same weight. As legal tender UK coinage, Britannias are exempt from capital gains ' +
            'tax for UK residents, which is often the deciding factor for British buyers choosing ' +
            'between them and cheaper imported silver.',
    },

    // -----------------------------------------------------------------------
    // Gold bullion.
    // -----------------------------------------------------------------------
    {
        slug: 'american-gold-eagle',
        name: 'American Gold Eagle (1 oz)',
        metal: 'gold',
        category: 'gold-bullion',
        grossGrams: 33.931,
        fineness: 0.9167,
        country: 'United States',
        years: '1986–present',
        faceValue: '$50',
        intro:
            'The American Gold Eagle contains a full troy ounce of pure gold, but weighs more than ' +
            'an ounce — it is 22 karat, alloyed with silver and copper for durability.',
        context:
            'This is the specification that confuses people most: the coin weighs 33.931 g, not ' +
            '31.103 g, because the alloy is added on top of a full ounce of gold rather than mixed ' +
            'into it. So a Gold Eagle and a .9999 fine Maple Leaf hold identical gold, and are ' +
            'worth the same at melt, despite the Eagle being visibly heavier and less pure.',
    },
    {
        slug: 'krugerrand',
        name: 'Krugerrand (1 oz)',
        metal: 'gold',
        category: 'gold-bullion',
        grossGrams: 33.93,
        fineness: 0.9167,
        country: 'South Africa',
        years: '1967–present',
        faceValue: 'None (legal tender by gold value)',
        intro:
            'The Krugerrand was the first modern bullion coin and remains the most widely held — ' +
            'one troy ounce of pure gold in a 22 karat alloy.',
        context:
            'Introduced in 1967 to market South African gold, the Krugerrand created the entire ' +
            'one-ounce bullion coin category that the Eagle, Maple and Britannia later copied. Its ' +
            'copper alloy gives it a distinctly warmer, redder tone than purer coins. It carries no ' +
            'face value at all — it is legal tender at whatever an ounce of gold is worth, which is ' +
            'unusual among bullion coins.',
    },
    {
        slug: 'canadian-gold-maple-leaf',
        name: 'Canadian Gold Maple Leaf (1 oz)',
        metal: 'gold',
        category: 'gold-bullion',
        grossGrams: 31.103,
        fineness: 0.9999,
        country: 'Canada',
        years: '1979–present',
        faceValue: 'C$50',
        intro:
            'The Gold Maple Leaf is .9999 fine — pure gold with no alloy, so the coin weighs ' +
            'exactly one troy ounce.',
        context:
            'Because there is no hardening alloy, the Maple is softer than a Krugerrand or Gold ' +
            'Eagle and shows handling marks far more easily, which is why they are usually kept in ' +
            'their original tubes or sleeves. The gold content is identical to a 22 karat one-ounce ' +
            'coin, so condition aside, melt value is the same.',
    },
    {
        slug: 'gold-britannia',
        name: 'Gold Britannia (1 oz)',
        metal: 'gold',
        category: 'gold-bullion',
        grossGrams: 31.103,
        fineness: 0.9999,
        country: 'United Kingdom',
        years: '1987–present (.9167 until 2012, .9999 from 2013)',
        faceValue: '£100',
        intro:
            'The Gold Britannia is the Royal Mint’s one-ounce bullion coin, .9999 fine since 2013, ' +
            'and exempt from UK capital gains tax for British residents.',
        context:
            'Britannias dated 2012 or earlier are 22 karat and weigh 34.05 g for the same one ounce ' +
            'of gold; from 2013 the coin is four-nines fine and weighs exactly one troy ounce. ' +
            'Either way the gold content is a full ounce. As UK legal tender, Britannias are free ' +
            'of capital gains tax for UK residents — the main reason British investors pay their ' +
            'premium over imported coins.',
    },
    {
        slug: 'gold-sovereign',
        name: 'Gold Sovereign',
        metal: 'gold',
        category: 'gold-bullion',
        grossGrams: 7.98805,
        fineness: 0.9167,
        country: 'United Kingdom',
        years: '1817–present',
        faceValue: '£1',
        intro:
            'The sovereign is Britain’s historic gold coin — 7.98805 g at 22 karat, containing ' +
            'just under a quarter of a troy ounce of gold.',
        context:
            'The sovereign has been struck to the same specification since 1817, which is why ' +
            'coins two centuries apart are interchangeable by weight. Its small size makes it the ' +
            'practical choice for selling gold in parts rather than committing to a full ounce, and ' +
            'like other UK legal tender it is exempt from capital gains tax for British residents. ' +
            'Note that a sovereign is not the same as a South Indian "sovereign" (savaran), which ' +
            'is 8 g of pure gold.',
        numismaticWarning:
            'Victorian and earlier sovereigns, and scarcer branch-mint issues, can carry collector ' +
            'premiums well above their gold content. Modern issues generally trade near melt.',
    },
    {
        slug: 'half-sovereign',
        name: 'Half Sovereign',
        metal: 'gold',
        category: 'gold-bullion',
        grossGrams: 3.99402,
        fineness: 0.9167,
        country: 'United Kingdom',
        years: '1817–present',
        faceValue: '50p (10 shillings pre-decimal)',
        intro:
            'The half sovereign is exactly half the weight of a sovereign — 3.99402 g at 22 karat ' +
            '— and the smallest widely traded British gold coin.',
        context:
            'Half sovereigns carry a higher premium per gram of gold than full sovereigns, because ' +
            'minting costs are much the same for a coin of half the size. They suit small, ' +
            'incremental buying and gift-giving, and share the sovereign’s UK capital gains tax ' +
            'exemption.',
    },
];

export function findCoin(slug: string): Coin | undefined {
    return COINS.find((coin) => coin.slug === slug.toLowerCase());
}

export function coinsByCategory(category: CoinCategory): Coin[] {
    return COINS.filter((coin) => coin.category === category);
}

export const CATEGORY_LABELS: Record<CoinCategory, string> = {
    'us-silver': 'US silver coins ("junk silver")',
    'silver-bullion': 'Silver bullion coins',
    'gold-bullion': 'Gold bullion coins',
};

/**
 * The US denominations sold by face value, used by the junk silver
 * calculator. Ordered as people actually count a jar.
 */
export const JUNK_SILVER_SLUGS = [
    'silver-dime',
    'silver-quarter',
    'silver-half-dollar',
    'kennedy-half-dollar-40-percent',
    'morgan-silver-dollar',
    'peace-silver-dollar',
    'silver-war-nickel',
] as const;
