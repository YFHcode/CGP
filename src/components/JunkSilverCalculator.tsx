'use client';

import { useMemo, useState } from 'react';

import { useCurrency } from '@/contexts/CurrencyContext';
import { formatCurrency } from '@/lib/currencies';
import { GRAMS_PER_OZ } from '@/lib/conversions';
import { COINS, JUNK_SILVER_SLUGS, pureTroyOz, type Coin } from '@/lib/coins';

/**
 * Counts a jar of US silver coins.
 *
 * This is the actual task behind "junk silver calculator" and "what is my
 * coin jar worth" — a mixed pile of denominations, not one coin at a time,
 * which is all the per-coin pages can answer. Quantities stay client-side;
 * only the spot price comes from the server.
 */

const JUNK_COINS: Coin[] = JUNK_SILVER_SLUGS.map(
    (slug) => COINS.find((coin) => coin.slug === slug)!
).filter(Boolean);

/** Short labels — the full catalogue names are too long for input rows. */
const SHORT_LABELS: Record<string, string> = {
    'silver-dime': 'Dimes (1964 or earlier)',
    'silver-quarter': 'Quarters (1964 or earlier)',
    'silver-half-dollar': 'Half dollars (1964 or earlier)',
    'kennedy-half-dollar-40-percent': 'Kennedy halves (1965–1970, 40%)',
    'morgan-silver-dollar': 'Morgan dollars',
    'peace-silver-dollar': 'Peace dollars',
    'silver-war-nickel': 'War nickels (1942–1945)',
};

export function JunkSilverCalculator({ spotPerOz }: { spotPerOz: number | null }) {
    const [counts, setCounts] = useState<Record<string, string>>({});
    const { convertPrice, activeCurrency } = useCurrency();

    const totals = useMemo(() => {
        let troyOz = 0;
        let faceValue = 0;

        for (const coin of JUNK_COINS) {
            const raw = counts[coin.slug];
            const count = raw ? Number.parseInt(raw, 10) : 0;
            if (!Number.isFinite(count) || count <= 0) continue;

            troyOz += pureTroyOz(coin) * count;

            // Face value is what dealers quote bags in, so it is worth
            // showing alongside the metal.
            const face = FACE_VALUES[coin.slug] ?? 0;
            faceValue += face * count;
        }

        return { troyOz, grams: troyOz * GRAMS_PER_OZ, faceValue };
    }, [counts]);

    const meltUsd = spotPerOz !== null ? totals.troyOz * spotPerOz : null;
    const melt = meltUsd !== null ? convertPrice(meltUsd) ?? meltUsd : null;

    const hasEntries = totals.troyOz > 0;

    return (
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6">
            <h2 className="mb-1 text-xl font-bold text-white">Junk silver calculator</h2>
            <p className="mb-6 text-sm text-zinc-400">
                Enter how many of each you have. Everything is worked out in your browser — nothing
                is sent anywhere.
            </p>

            <div className="space-y-3">
                {JUNK_COINS.map((coin) => (
                    <div key={coin.slug} className="flex items-center gap-3">
                        <label
                            htmlFor={`count-${coin.slug}`}
                            className="flex-1 text-sm text-zinc-300"
                        >
                            {SHORT_LABELS[coin.slug] ?? coin.name}
                            <span className="ml-2 text-xs text-zinc-500">
                                {pureTroyOz(coin).toFixed(4)} ozt each
                            </span>
                        </label>
                        <input
                            id={`count-${coin.slug}`}
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            placeholder="0"
                            value={counts[coin.slug] ?? ''}
                            onChange={(event) =>
                                setCounts((prev) => ({ ...prev, [coin.slug]: event.target.value }))
                            }
                            className="w-24 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right text-white focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
                        />
                    </div>
                ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-6">
                {hasEntries ? (
                    <dl className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <dt className="text-sm text-zinc-400">Total silver</dt>
                            <dd className="text-lg font-medium text-white">
                                {totals.troyOz.toFixed(3)} ozt
                                <span className="ml-2 text-sm text-zinc-400">
                                    ({totals.grams.toFixed(1)} g)
                                </span>
                            </dd>
                        </div>
                        <div className="flex items-baseline justify-between">
                            {/* Deliberately not currency-converted: this is the
                                coins' US denominational face value, which is
                                dollars by definition. Labelled so it does not
                                read as a bug next to a converted melt value. */}
                            <dt className="text-sm text-zinc-400">US face value</dt>
                            <dd className="text-sm text-zinc-300">
                                ${totals.faceValue.toFixed(2)}
                            </dd>
                        </div>
                        <div className="flex items-baseline justify-between border-t border-white/5 pt-2">
                            <dt className="font-medium text-zinc-300">Melt value</dt>
                            <dd className="text-2xl font-bold text-gold-300">
                                {melt !== null
                                    ? formatCurrency(melt, activeCurrency, {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                      })
                                    : '—'}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <p className="text-sm text-zinc-500">
                        Enter a quantity above to see what your coins are worth.
                    </p>
                )}
            </div>

            <p className="mt-4 text-xs text-zinc-500">
                Melt value is the silver content only, before any dealer margin. Scrap buyers
                typically pay 80–95% of melt. Check dates and mintmarks first — key dates are worth
                far more to a collector than to a refiner.
            </p>
        </div>
    );
}

/** Face value in dollars, for the running total. */
const FACE_VALUES: Record<string, number> = {
    'silver-dime': 0.1,
    'silver-quarter': 0.25,
    'silver-half-dollar': 0.5,
    'kennedy-half-dollar-40-percent': 0.5,
    'morgan-silver-dollar': 1,
    'peace-silver-dollar': 1,
    'silver-war-nickel': 0.05,
};
