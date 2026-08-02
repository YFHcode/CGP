import Link from 'next/link';
import { Newspaper, ArrowRight } from 'lucide-react';

import { getNews } from '@/lib/news-api';
import { NewsCard } from './NewsCard';

/**
 * Rendered on the server.
 *
 * This used to be a client component that fetched /api/news from a useEffect,
 * which cost every visitor an extra round-trip, produced a loading flash, and
 * pulled the news module (and its API key) into the client import graph.
 *
 * The horizontal carousel is now a scroll-snap list: it stays swipeable on
 * touch devices, is keyboard-scrollable, and needs no JS. The old version
 * translated by a hardcoded 350px while the cards were 300px/350px wide plus a
 * 24px gap, so it drifted out of alignment on every click at both breakpoints.
 */
export async function NewsSection() {
    const news = await getNews();

    if (news.length === 0) {
        return null;
    }

    return (
        <section className="bg-black py-16">
            <div className="container mx-auto px-4">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Newspaper className="h-6 w-6 text-gold-400" aria-hidden="true" />
                        <h2 className="text-2xl font-bold text-white">Market news</h2>
                    </div>
                    <Link
                        href="/news"
                        className="inline-flex shrink-0 items-center gap-1 text-sm text-gold-400 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    >
                        View all
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>

                <ul
                    className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:thin]"
                    aria-label="Latest gold market news"
                >
                    {news.slice(0, 12).map((item) => (
                        <li key={item.link} className="w-[300px] shrink-0 snap-start md:w-[350px]">
                            <NewsCard item={item} />
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
