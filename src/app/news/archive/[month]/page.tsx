import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { JsonLd } from '@/components/JsonLd';
import { getNewsArchive, groupArchiveByMonth } from '@/lib/prices';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';
import { parsePeriod } from '@/lib/history-periods';

export const revalidate = 86400;

export async function generateStaticParams() {
    const { items } = await getNewsArchive();
    return [...groupArchiveByMonth(items).keys()].map((month) => ({ month }));
}

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }) {
    const { month } = await params;
    const period = parsePeriod(month);
    const label = period?.label ?? month;

    return pageMetadata({
        title: `Gold News, ${label}`,
        description: `Gold and precious-metals headlines tracked during ${label}, linking to the original publishers.`,
        path: `/news/archive/${month}`,
        keywords: [`gold news ${label.toLowerCase()}`, 'gold market headlines'],
    });
}

export default async function NewsArchiveMonthPage({
    params,
}: {
    params: Promise<{ month: string }>;
}) {
    const { month } = await params;
    const period = parsePeriod(month);
    if (!period || period.kind !== 'month') notFound();

    const { items } = await getNewsArchive();
    const entries = groupArchiveByMonth(items).get(month);
    if (!entries || entries.length === 0) notFound();

    const sorted = [...entries].sort((a, b) => b.seenAt.localeCompare(a.seenAt));

    return (
        <>
            <JsonLd schema={breadcrumbSchema([
                { name: 'Market news', path: '/news' },
                { name: 'Archive', path: '/news/archive' },
                { name: period.label, path: `/news/archive/${month}` },
            ])} />
            <Breadcrumbs
                trail={[
                    { name: 'Market news', href: '/news' },
                    { name: 'Archive', href: '/news/archive' },
                    { name: period.label, href: `/news/archive/${month}` },
                ]}
            />

            <section className="bg-zinc-900/50 py-10">
                <div className="container mx-auto px-4">
                    <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">
                        Gold news, {period.label}
                    </h1>
                    <p className="max-w-3xl text-zinc-300">
                        {sorted.length} {sorted.length === 1 ? 'headline' : 'headlines'} tracked
                        during {period.label}. Each links to the original article on the
                        publisher&apos;s own site.
                    </p>
                </div>
            </section>

            <section className="bg-black py-10">
                <div className="container mx-auto px-4">
                    <ul className="mx-auto max-w-4xl divide-y divide-white/5">
                        {sorted.map((entry) => (
                            <li key={entry.link} className="py-4">
                                <a
                                    href={entry.link}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="group block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                >
                                    <span className="flex items-start gap-2 font-medium text-white transition-colors group-hover:text-gold-300">
                                        {entry.title}
                                        <ExternalLink
                                            className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-500"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-400">
                                        <span className="text-gold-400">{entry.source}</span>
                                        {entry.reportedDate && <span>{entry.reportedDate}</span>}
                                        <time dateTime={entry.seenAt}>
                                            indexed{' '}
                                            {new Date(entry.seenAt).toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                timeZone: 'UTC',
                                            })}
                                        </time>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                    <p className="mx-auto mt-6 max-w-4xl text-xs text-zinc-400">
                        Headlines and links are indexed for reference. Copyright in each article
                        remains with its publisher; follow the link to read it on their site.
                    </p>
                </div>
            </section>

            <RelatedLinks
                links={relatedLinks('news', 'goldToday', 'silverToday', 'history', 'calculator', 'blog')}
            />
        </>
    );
}
