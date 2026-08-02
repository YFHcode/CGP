import Link from 'next/link';
import { Archive } from 'lucide-react';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { getNewsArchive, groupArchiveByMonth } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { parsePeriod } from '@/lib/history-periods';

export const revalidate = 86400;

export const metadata = pageMetadata({
    title: 'Gold News Archive',
    description:
        'A dated index of gold and precious-metals headlines we have tracked, linking out to the original publishers.',
    path: '/news/archive',
    keywords: ['gold news archive', 'gold market headlines', 'precious metals news history'],
});

export default async function NewsArchiveIndexPage() {
    const { items } = await getNewsArchive();
    const byMonth = groupArchiveByMonth(items);
    const months = [...byMonth.keys()].sort().reverse();

    return (
        <>
            <JsonLd schema={breadcrumbSchema([
                { name: 'Market news', path: '/news' },
                { name: 'Archive', path: '/news/archive' },
            ])} />
            <Breadcrumbs
                trail={[
                    { name: 'Market news', href: '/news' },
                    { name: 'Archive', href: '/news/archive' },
                ]}
            />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <div className="mb-3 flex items-center gap-3">
                        <Archive className="h-7 w-7 text-gold-400" aria-hidden="true" />
                        <h1 className="text-3xl font-bold text-white md:text-4xl">Gold news archive</h1>
                    </div>
                    <p className="max-w-3xl text-zinc-300">
                        A dated index of the headlines we have tracked, month by month. Every entry
                        links straight to the original publisher — we index the links, we do not
                        reproduce the articles.
                    </p>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    {months.length === 0 ? (
                        <p className="text-zinc-300">
                            The archive is empty for now. Headlines are collected on a schedule and
                            will accumulate here automatically.
                        </p>
                    ) : (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {months.map((month) => (
                                <li key={month}>
                                    <Link
                                        href={`/news/archive/${month}`}
                                        className="flex items-baseline justify-between gap-2 rounded-lg border border-white/10 px-4 py-3 transition-colors hover:border-gold-500/30"
                                    >
                                        <span className="text-zinc-200">
                                            {parsePeriod(month)?.label ?? month}
                                        </span>
                                        <span className="shrink-0 text-xs text-zinc-400">
                                            {byMonth.get(month)?.length ?? 0}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks('news', 'goldToday', 'silverToday', 'history', 'calculator', 'blog')}
            />
        </>
    );
}
