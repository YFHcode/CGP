import { Newspaper } from 'lucide-react';

import { NewsCard } from '@/components/NewsCard';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getNews } from '@/lib/news-api';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'Gold Market News',
    description:
        'The latest gold and precious-metals market news, updated through the day. Headlines on prices, central bank buying, inflation and mining supply.',
    path: '/news',
    keywords: ['gold news', 'gold market news', 'precious metals news', 'silver news'],
});

export default async function NewsPage() {
    const news = await getNews();

    return (
        <>
            <JsonLd schema={breadcrumbSchema([{ name: 'Market news', path: '/news' }])} />
            <Breadcrumbs trail={[{ name: 'Market news', href: '/news' }]} />

            <div className="bg-black py-12">
                <div className="container mx-auto px-4">
                    <div className="mb-8 flex items-center gap-3">
                        <Newspaper className="h-8 w-8 text-gold-400" aria-hidden="true" />
                        <h1 className="text-4xl font-bold text-white">Gold Market News</h1>
                    </div>

                    {news.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-8 text-center">
                            <p className="font-medium text-zinc-200">No headlines available right now</p>
                            <p className="mt-2 text-sm text-zinc-400">
                                The news feed is refreshed regularly — please check back shortly.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {news.map((item, index) => (
                                <NewsCard
                                    key={item.link}
                                    item={item}
                                    imageHeight={192}
                                    priority={index < 3}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <RelatedLinks
                links={relatedLinks('goldToday', 'silverToday', 'history', 'calculator', 'blog', 'home')}
            />
        </>
    );
}
