import { NextResponse } from 'next/server';
import { getRates } from '@/lib/prices';

/**
 * Every visitor hits this on mount, so it must be cacheable at the CDN.
 * Without these headers Next serves route handlers as no-store, turning each
 * pageview into a serverless invocation.
 *
 * Reads the committed data/rates.json snapshot via getRates() — the same
 * source every other price/history endpoint uses — instead of calling the
 * live FX API directly. That had every visitor who opened the currency
 * selector burning a live API call, defeating the entire point of the
 * snapshot architecture for this one endpoint.
 */
export const revalidate = 10800; // 3 hours

export async function GET() {
    const { rates } = await getRates();

    // getRates() always returns at least { USD: 1 } as a last resort, so an
    // empty object can't happen — but a USD-only result means neither the
    // snapshot nor its live fallback produced real conversion data, which
    // should still read as "unavailable" to the client rather than a
    // silent success with nothing to actually convert to.
    if (!rates || Object.keys(rates).length <= 1) {
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
