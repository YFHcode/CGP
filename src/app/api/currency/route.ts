import { NextResponse } from 'next/server';
import { getExchangeRates } from '@/lib/currency-api';

/**
 * Every visitor hits this on mount, so it must be cacheable at the CDN.
 * Without these headers Next serves route handlers as no-store, turning each
 * pageview into a serverless invocation.
 */
export const revalidate = 10800; // 3 hours

export async function GET() {
    const rates = await getExchangeRates();

    if (!rates) {
        // Signal failure instead of returning {} — an empty object is
        // indistinguishable from "all rates are 1" to the client.
        return NextResponse.json(
            { error: 'Exchange rates temporarily unavailable' },
            { status: 503, headers: { 'Cache-Control': 'public, max-age=60' } }
        );
    }

    return NextResponse.json(rates, {
        headers: {
            'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
        },
    });
}
