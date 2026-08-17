'use client';

import { useId, useState } from 'react';
import { Scale } from 'lucide-react';

import { useCurrency } from '@/contexts/CurrencyContext';
import { WEIGHT_UNITS, type WeightUnit } from '@/lib/conversions';
import {
    SCRAP_BUYERS,
    SCRAP_KARATS,
    SCRAP_KARAT_LABELS,
    SCRAP_KARAT_PURITY,
    valueScrapGold,
    type ScrapKarat,
} from '@/lib/scrap-gold';
import { formatCurrency } from '@/lib/currencies';
import { ToggleGroup } from './UnitToggle';

/**
 * Scrap gold calculator.
 *
 * The melt calculator answers "what is the metal worth". This answers "what
 * will someone pay me for it", which is a materially smaller number — and
 * showing both, with the gap made explicit, is the entire point of the tool.
 *
 * The result is a range rather than a single figure, because that is the
 * honest shape of the answer.
 */
export function ScrapGoldCalculator({ spotPerOz }: { spotPerOz: number | null }) {
    const [weight, setWeight] = useState('10');
    const [unit, setUnit] = useState<WeightUnit>('gram');
    const [karat, setKarat] = useState<ScrapKarat>('14K');
    const [buyerId, setBuyerId] = useState(SCRAP_BUYERS[1].id); // jeweller: the realistic default
    const { convertPrice, activeCurrency } = useCurrency();

    const weightId = useId();
    const buyer = SCRAP_BUYERS.find((b) => b.id === buyerId) ?? SCRAP_BUYERS[1];

    const parsed = Number.parseFloat(weight);
    const isBlank = weight.trim() === '';
    // `min="0"` only constrains the spinner, not typed input, so a negative
    // weight has to be rejected here.
    const isInvalid = !isBlank && (!Number.isFinite(parsed) || parsed < 0);

    const valuation = valueScrapGold(spotPerOz ?? Number.NaN, parsed, unit, karat, buyer);
    const money = (usd: number) => formatCurrency(convertPrice(usd) ?? usd, activeCurrency);

    const hasResult = valuation.melt > 0;

    return (
        <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm">
            <div className="mb-1 flex items-center gap-2">
                <Scale className="h-5 w-5 text-gold-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-white">Scrap gold calculator</h2>
            </div>
            <p className="mb-6 text-sm text-zinc-400">
                Worked out in your browser — nothing is sent anywhere.
            </p>

            <div className="space-y-5">
                <div>
                    <label htmlFor={weightId} className="mb-2 block text-sm font-medium text-zinc-300">
                        Weight
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            id={weightId}
                            type="number"
                            inputMode="decimal"
                            value={weight}
                            onChange={(event) => setWeight(event.target.value)}
                            min="0"
                            step="0.01"
                            aria-invalid={isInvalid}
                            aria-describedby={isInvalid ? `${weightId}-error` : undefined}
                            className="w-full min-w-0 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-400 focus:border-gold-400 focus:outline-none focus:ring-1 focus:ring-gold-400 sm:flex-1"
                            placeholder="Enter weight"
                        />
                        <ToggleGroup
                            label="Weight unit"
                            options={WEIGHT_UNITS}
                            value={unit}
                            onChange={setUnit}
                            size="sm"
                            className="w-full sm:w-auto sm:shrink-0"
                        />
                    </div>
                    {isInvalid && (
                        <p id={`${weightId}-error`} role="alert" className="mt-2 text-sm text-red-300">
                            Enter a weight of zero or more.
                        </p>
                    )}
                </div>

                <div>
                    <span className="mb-2 block text-sm font-medium text-zinc-300">
                        Purity (check the stamp)
                    </span>
                    <ToggleGroup
                        label="Gold purity"
                        options={SCRAP_KARATS}
                        value={karat}
                        onChange={setKarat}
                        renderLabel={(k) => SCRAP_KARAT_LABELS[k]}
                        renderHint={(k) => `${(SCRAP_KARAT_PURITY[k] * 100).toFixed(1)}%`}
                        className="grid grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4"
                    />
                </div>

                <div>
                    <span className="mb-2 block text-sm font-medium text-zinc-300">Selling to</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {SCRAP_BUYERS.map((option) => {
                            const selected = option.id === buyer.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setBuyerId(option.id)}
                                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                                        selected
                                            ? 'border-gold-500/40 bg-gold-500/10 text-white'
                                            : 'border-white/10 text-zinc-300 hover:border-white/20'
                                    }`}
                                >
                                    <span className="block font-medium">{option.label}</span>
                                    <span className="text-xs text-zinc-400">
                                        {Math.round(option.low * 100)}–{Math.round(option.high * 100)}%
                                        of melt
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div
                    className="rounded-lg border border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-gold-600/10 p-4"
                    aria-live="polite"
                >
                    {hasResult ? (
                        <>
                            <p className="mb-1 text-sm text-zinc-300">
                                Likely offer from a {buyer.label.toLowerCase()}
                            </p>
                            <p className="text-3xl font-bold text-gold-300">
                                {money(valuation.payoutLow)} – {money(valuation.payoutHigh)}
                            </p>
                            <dl className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-zinc-400">Pure gold content</dt>
                                    <dd className="text-zinc-200">
                                        {valuation.pureGrams.toFixed(2)} g
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-zinc-400">Melt value (full metal value)</dt>
                                    <dd className="font-medium text-white">{money(valuation.melt)}</dd>
                                </div>
                            </dl>
                        </>
                    ) : (
                        <p className="text-sm text-zinc-400">
                            {spotPerOz
                                ? 'Enter a weight above to see what your scrap is worth.'
                                : 'The current gold price is unavailable, so no estimate can be shown.'}
                        </p>
                    )}
                </div>

                <p className="text-sm text-zinc-300">{buyer.note}</p>

                <p className="text-xs text-zinc-500">
                    Melt value is the metal content at the current spot price and is the ceiling, not
                    an offer. Payout bands are typical industry ranges, not quotes — the rate you are
                    actually offered depends on quantity, karat mix and the buyer. Weigh items of
                    different purity separately: a mixed pile valued at its highest karat will
                    overstate what it is worth.
                </p>
            </div>
        </div>
    );
}
