import { NextResponse } from 'next/server';
import { getNews } from '@/lib/news-api';

// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

export async function GET() {
    const news = await getNews();

    return NextResponse.json(news, {
        headers: {
            'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
        },
    });
}
