'use client';

import { useId, useState } from 'react';
import { Calculator } from 'lucide-react';

import { useCurrency } from '@/contexts/CurrencyContext';
import {
    KARATS,
    KARAT_PURITY,
    WEIGHT_UNITS,
    calculateGoldValue,
    pricePerUnit,
    type Karat,
    type WeightUnit,
} from '@/lib/conversions';
import { formatCurrency, formatMetalPrice } from '@/lib/currencies';
import { ToggleGroup } from './UnitToggle';

interface GoldCalculatorProps {
    /** Spot gold price per troy ounce, in USD. */
    goldPricePerOz: number;
}

export function GoldCalculator({ goldPricePerOz }: GoldCalculatorProps) {
    const [weight, setWeight] = useState('1');
    const [unit, setUnit] = useState<WeightUnit>('oz');
    const [karat, setKarat] = useState<Karat>('24K');
    const { convertPrice, currency } = useCurrency();

    const weightId = useId();

    const parsed = Number.parseFloat(weight);
    const isBlank = weight.trim() === '';
    // `min="0"` only constrains the spinner, not typed input, so negatives have
    // to be rejected here or the calculator happily values -5 oz of gold.
    const isInvalid = !isBlank && (!Number.isFinite(parsed) || parsed < 0);
    const weightNum = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

    const valueUSD = calculateGoldValue(goldPricePerOz, weightNum, unit, karat);

    const converted = convertPrice(valueUSD);
    const usingFallback = converted === null;
    const displayCurrency = usingFallback ? 'USD' : currency;
    const displayValue = converted ?? valueUSD;

    // The reference price must be shown in the same currency as the result —
    // it used to be hardcoded to "$" while the result was converted.
    const referenceUSD = pricePerUnit(goldPricePerOz, unit);
    const referenceConverted = convertPrice(referenceUSD);
    const reference = usingFallback ? referenceUSD : referenceConverted ?? referenceUSD;

    return (
        <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-2">
                <Calculator className="h-5 w-5 text-gold-400" aria-hidden="true" />
                <h2 className="text-xl font-bold text-white">Gold Value Calculator</h2>
            </div>

            <div className="space-y-5">
                <div>
                    <label htmlFor={weightId} className="mb-2 block text-sm font-medium text-zinc-300">
                        Weight
                    </label>
                    {/* Stacked on narrow screens: side by side, the input plus a
                        three-option toggle overflowed the card off-screen. */}
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
                    <span className="mb-2 block text-sm font-medium text-zinc-300">Purity (karat)</span>
                    <ToggleGroup
                        label="Gold purity in karat"
                        options={KARATS}
                        value={karat}
                        onChange={setKarat}
                        renderHint={(k) => `${(KARAT_PURITY[k] * 100).toFixed(1)}%`}
                        className="grid grid-cols-3 gap-2 bg-transparent p-0 sm:grid-cols-6"
                    />
                </div>

                <div
                    className="rounded-lg border border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-gold-600/10 p-4"
                    aria-live="polite"
                >
                    <p className="mb-1 text-sm text-zinc-300">Estimated value</p>
                    <p className="text-3xl font-bold text-gold-300">
                        {formatCurrency(displayValue, displayCurrency)}
                    </p>
                    {usingFallback && currency !== 'USD' && (
                        <p className="mt-2 text-xs text-amber-300/90">
                            {currency} rates are unavailable, so this value is shown in USD.
                        </p>
                    )}
                </div>

                <p className="text-center text-xs text-zinc-400">
                    Based on a spot price of {formatMetalPrice(reference, displayCurrency)} per {unit}.
                    Melt value only — it excludes dealer margins, fabrication and taxes.
                </p>
            </div>
        </div>
    );
}
