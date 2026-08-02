/**
 * Client-safe currency metadata and formatting.
 *
 * Deliberately free of server-only imports so client components can use it.
 */

export const SUPPORTED_CURRENCIES = [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'JPY',
    'CNY',
    'INR',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

export function isSupportedCurrency(value: unknown): value is SupportedCurrency {
    return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Locale used for grouping per currency. INR gets en-IN so it groups in lakh/
 * crore the way Indian readers expect; the rest stay en-US for consistency.
 */
const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    CAD: 'en-CA',
    AUD: 'en-AU',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    INR: 'en-IN',
};

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    CAD: 'Canadian Dollar',
    AUD: 'Australian Dollar',
    JPY: 'Japanese Yen',
    CNY: 'Chinese Yuan',
    INR: 'Indian Rupee',
};

function localeFor(currency: string): string {
    return CURRENCY_LOCALES[currency as SupportedCurrency] ?? 'en-US';
}

/**
 * Formats a monetary amount with the correct symbol and the number of decimal
 * places that currency actually uses — Intl knows JPY has none, so this stops
 * yen rendering as "¥1,234.00".
 */
export function formatCurrency(
    amount: number,
    currency: string,
    options: Intl.NumberFormatOptions = {}
): string {
    if (!Number.isFinite(amount)) return '—';

    try {
        return new Intl.NumberFormat(localeFor(currency), {
            style: 'currency',
            currency,
            ...options,
        }).format(amount);
    } catch {
        // Unknown currency code: fall back to a plain number plus the code.
        return `${amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })} ${currency}`;
    }
}

/**
 * Formats a precious-metal price. Per-gram values need more precision than
 * per-kilo ones, so significant digits are chosen from the magnitude rather
 * than fixed at two.
 */
export function formatMetalPrice(amount: number, currency: string): string {
    if (!Number.isFinite(amount)) return '—';

    const decimals = amount < 10 ? 3 : 2;
    return formatCurrency(amount, currency, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/** Formats a signed percentage, e.g. "+1.24%" / "-0.53%". */
export function formatPercent(value: number): string {
    if (!Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${Math.abs(value).toFixed(2)}%`;
}

/** Formats a plain number (ratios, counts) without a currency symbol. */
export function formatNumber(value: number, decimals = 2): string {
    if (!Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}
