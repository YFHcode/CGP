import { NextResponse } from 'next/server';
import { getNews } from '@/lib/news-api';

export const revalidate = 10800; // 3 hours

export async function GET() {
    const news = await getNews();

    return NextResponse.json(news, {
        headers: {
            'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
        },
    });
}
