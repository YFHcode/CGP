import Link from 'next/link';
import { BookOpen, Calendar, ArrowRight } from 'lucide-react';

import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RelatedLinks, relatedLinks } from '@/components/RelatedLinks';
import { getBlogPosts, formatPostDate } from '@/sanity/queries';
import { breadcrumbSchema, pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Gold & Silver Market Blog',
  description:
    'Articles on gold and silver prices, market analysis and precious-metals investing — how the market works and what moves it.',
  path: '/blog',
  keywords: ['gold blog', 'precious metals blog', 'gold investment', 'gold market analysis'],
});

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: 'Blog', path: '/blog' }])} />
      <Breadcrumbs trail={[{ name: 'Blog', href: '/blog' }]} />

      <section className="bg-zinc-900/50 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-center justify-center gap-3">
            <BookOpen className="h-8 w-8 text-gold-400" aria-hidden="true" />
            <h1 className="text-4xl font-bold text-white md:text-5xl">Precious Metals Blog</h1>
          </div>
          <p className="mx-auto max-w-3xl text-center text-zinc-300">
            Analysis and explainers on gold, silver and precious-metals investing.
          </p>
        </div>
      </section>

      <section className="bg-black py-12">
        <div className="container mx-auto px-4">
          {posts.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-xl border border-white/10 bg-zinc-900/50 p-8 text-center">
              <p className="font-medium text-zinc-200">No articles published yet</p>
              <p className="mt-2 text-sm text-zinc-400">
                New posts will appear here as they are published.
              </p>
            </div>
          ) : (
            <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const published = formatPostDate(post.publishedAt);
                return (
                  <article
                    key={post._id}
                    className="group overflow-hidden rounded-lg border border-white/10 transition-all hover:border-gold-500/30"
                  >
                    <div className="p-6">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="rounded-full border border-gold-500/20 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-300">
                          Article
                        </span>
                        {published && (
                          <span className="flex items-center gap-1 text-xs text-zinc-400">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            {published}
                          </span>
                        )}
                      </div>
                      <h2 className="mb-3 text-xl font-bold text-white transition-colors group-hover:text-gold-300">
                        <Link href={`/blog/${post.slug.current}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">
                          {post.title}
                        </Link>
                      </h2>
                      {post.excerpt && (
                        <p className="mb-4 line-clamp-3 text-sm text-zinc-300">{post.excerpt}</p>
                      )}
                      <Link
                        href={`/blog/${post.slug.current}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-gold-400 transition-colors hover:text-gold-300"
                        tabIndex={-1}
                      >
                        Read more
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <RelatedLinks
        title="Prices and tools"
        links={relatedLinks('goldToday', 'silverToday', 'calculator', 'history', 'goldChart', 'news')}
      />
    </>
  );
}
