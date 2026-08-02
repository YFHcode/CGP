import 'server-only';
import { unstable_cache } from 'next/cache';
import { SUPPORTED_CURRENCIES } from './currencies';

// Kept in source deliberately (free tier). Env var wins when present.
const API_KEY =
    process.env.CURRENCY_API_KEY || 'fca_live_Ik8ZCBK09jDNbxQPqYHaD6q4WyEtJqu9Qw80hoPr';
const BASE_URL = 'https://api.freecurrencyapi.com/v1/latest';

/** 3 hours. */
const REVALIDATE_SECONDS = 10800;

export type ExchangeRates = Record<string, number>;

async function fetchExchangeRates(): Promise<ExchangeRates> {
    const params = new URLSearchParams({
        apikey: API_KEY,
        base_currency: 'USD',
        currencies: SUPPORTED_CURRENCIES.filter((c) => c !== 'USD').join(','),
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`CurrencyAPI: ${response.status} ${response.statusText}`);
    }

    const body = await response.json();
    const rates: unknown = body?.data;

    if (!rates || typeof rates !== 'object') {
        throw new Error('CurrencyAPI: response carried no rates');
    }

    // Drop anything non-numeric so a bad rate can't silently mislabel a price.
    const clean: ExchangeRates = { USD: 1 };
    for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            clean[code] = value;
        }
    }

    if (Object.keys(clean).length <= 1) {
        throw new Error('CurrencyAPI: no usable rates in response');
    }

    return clean;
}

const cachedRates = unstable_cache(fetchExchangeRates, ['exchange-rates-usd'], {
    revalidate: REVALIDATE_SECONDS,
    tags: ['rates'],
});

/**
 * Returns null on failure rather than an empty object, so callers can tell
 * "rates unavailable" apart from "USD only" and label prices honestly.
 */
export async function getExchangeRates(): Promise<ExchangeRates | null> {
    try {
        return await cachedRates();
    } catch (error) {
        console.error('[CurrencyAPI] unavailable:', error instanceof Error ? error.message : error);
        return null;
    }
}
