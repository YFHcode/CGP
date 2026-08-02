'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import {
    DEFAULT_CURRENCY,
    isSupportedCurrency,
    type SupportedCurrency,
} from '@/lib/currencies';

const STORAGE_KEY = 'cgp:currency';

type Rates = Record<string, number>;

interface CurrencyContextType {
    currency: SupportedCurrency;
    setCurrency: (currency: SupportedCurrency) => void;
    rates: Rates | null;
    /** True while rates are still loading on first mount. */
    isLoading: boolean;
    /** True when rates could not be fetched — prices stay in USD. */
    hasError: boolean;
    /**
     * Converts a USD amount into the selected currency.
     * Returns null when conversion isn't possible, so callers must decide how
     * to present that rather than silently showing a USD number under a
     * non-USD label.
     */
    convertPrice: (priceInUSD: number) => number | null;
    /**
     * The currency amounts are actually denominated in right now. Falls back to
     * USD when rates are unavailable so labels never lie about the number.
     */
    activeCurrency: SupportedCurrency;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
    const [rates, setRates] = useState<Rates | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // Restore the visitor's previous choice. Done in an effect rather than in
    // useState so server and client render the same thing on first paint.
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (isSupportedCurrency(stored)) setCurrencyState(stored);
        } catch {
            // Private browsing / storage disabled — fall back to the default.
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchRates() {
            try {
                const res = await fetch('/api/currency', { signal: controller.signal });
                if (!res.ok) throw new Error(`rates request failed: ${res.status}`);

                const data: unknown = await res.json();
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('rates response was not an object');
                }

                const clean: Rates = { USD: 1 };
                for (const [code, value] of Object.entries(data as Record<string, unknown>)) {
                    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
                        clean[code] = value;
                    }
                }

                setRates(clean);
                setHasError(false);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch currency rates', error);
                setHasError(true);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }

        fetchRates();
        return () => controller.abort();
    }, []);

    const setCurrency = useCallback((next: SupportedCurrency) => {
        setCurrencyState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Non-fatal: the choice just won't survive a reload.
        }
    }, []);

    const convertPrice = useCallback(
        (priceInUSD: number): number | null => {
            if (!Number.isFinite(priceInUSD)) return null;
            if (currency === 'USD') return priceInUSD;

            const rate = rates?.[currency];
            if (!rate || !Number.isFinite(rate)) return null;

            return priceInUSD * rate;
        },
        [currency, rates]
    );

    // When rates are missing we can still render USD honestly, so amounts stay
    // visible and the label matches the number.
    const canConvert = currency === 'USD' || Boolean(rates && rates[currency]);
    const activeCurrency: SupportedCurrency = canConvert ? currency : DEFAULT_CURRENCY;

    const value = useMemo(
        () => ({ currency, setCurrency, rates, isLoading, hasError, convertPrice, activeCurrency }),
        [currency, setCurrency, rates, isLoading, hasError, convertPrice, activeCurrency]
    );

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}

/**
 * Converts a USD price and returns both the amount and the currency it is
 * actually denominated in — components need that pairing to label prices
 * truthfully when a rate is unavailable.
 */
export function useConvertedPrice(priceInUSD: number | null | undefined) {
    const { convertPrice, currency, activeCurrency } = useCurrency();

    if (priceInUSD === null || priceInUSD === undefined || !Number.isFinite(priceInUSD)) {
        return { amount: null, currency: activeCurrency };
    }

    const converted = convertPrice(priceInUSD);
    return converted === null
        ? { amount: priceInUSD, currency: 'USD' as SupportedCurrency }
        : { amount: converted, currency };
}
