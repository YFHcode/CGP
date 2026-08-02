import { NextResponse } from 'next/server';
import { getPrices } from '@/lib/prices';
import type { MetalSymbol } from '@/types';

export const revalidate = 3600;

const VALID_SYMBOLS: MetalSymbol[] = ['XAU', 'XAG'];

function isMetalSymbol(value: string | null): value is MetalSymbol {
    return value !== null && (VALID_SYMBOLS as string[]).includes(value);
}

/**
 * Prices are always quoted in USD; clients convert using /api/currency. The old
 * `currency` query param was accepted but always coerced to USD, so it is gone
 * rather than left looking functional.
 */
export async function GET(request: Request) {
    const symbol = new URL(request.url).searchParams.get('symbol');

    if (!isMetalSymbol(symbol)) {
        return NextResponse.json(
            { error: 'Invalid symbol. Use XAU or XAG.' },
            { status: 400 }
        );
    }

    const { gold, silver, updatedAt } = await getPrices();
    const data = symbol === 'XAU' ? gold : silver;

    if (!data) {
        return NextResponse.json(
            { error: 'Price data temporarily unavailable' },
            { status: 503, headers: { 'Cache-Control': 'public, max-age=60' } }
        );
    }

    return NextResponse.json(
        { ...data, updatedAt },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        }
    );
}
