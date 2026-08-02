import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PortableText } from 'next-sanity';
import { createImageUrlBuilder } from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url';
import { ArrowLeft, Calendar } from 'lucide-react';

import { client } from '@/sanity/client';
import { getBlogPost, getBlogSlugs, formatPostDate } from '@/sanity/queries';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo';

const { projectId, dataset } = client.config();

const urlFor = (source: SanityImageSource) =>
    projectId && dataset ? createImageUrlBuilder({ projectId, dataset }).image(source) : null;

/** Prerender published posts so they are static and crawlable. */
export async function generateStaticParams() {
    const slugs = await getBlogSlugs();
    return slugs.map((slug) => ({ slug }));
}

/**
 * Per-post metadata. Without this every post inherited the site-wide title and
 * description — and, before the canonical fix, pointed its canonical at the
 * homepage.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await getBlogPost(slug);

    if (!post) {
        return pageMetadata({
            title: 'Post not found',
            description: 'This article does not exist.',
            path: `/blog/${slug}`,
            noIndex: true,
        });
    }

    const description =
        typeof post.excerpt === 'string' && post.excerpt
            ? post.excerpt.slice(0, 200)
            : `${post.title} — analysis and insight from ${SITE_NAME}.`;

    return pageMetadata({
        title: post.title,
        description,
        path: `/blog/${slug}`,
        type: 'article',
        publishedTime: typeof post.publishedAt === 'string' ? post.publishedAt : undefined,
    });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const post = await getBlogPost(slug);

    // A missing post must be a real 404. Rendering a "not found" body with a
    // 200 status made these soft 404s, which Google indexes as thin pages.
    if (!post) notFound();

    const imageUrl = post.image ? urlFor(post.image as SanityImageSource)?.width(1200).height(675).url() : null;
    const published = formatPostDate(post.publishedAt, 'long');

    return (
        <>
            <JsonLd
                schema={[
                    breadcrumbSchema([
                        { name: 'Blog', path: '/blog' },
                        { name: post.title, path: `/blog/${slug}` },
                    ]),
                    {
                        '@context': 'https://schema.org',
                        '@type': 'BlogPosting',
                        headline: post.title,
                        datePublished: post.publishedAt,
                        image: imageUrl ?? undefined,
                        author: { '@type': 'Organization', name: SITE_NAME },
                        publisher: {
                            '@type': 'Organization',
                            name: SITE_NAME,
                            logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.png` },
                        },
                        mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
                    },
                ]}
            />

            <article className="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
                <Link
                    href="/blog"
                    className="inline-flex w-fit items-center gap-2 rounded text-gold-400 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to blog
                </Link>

                {imageUrl && (
                    <Image
                        src={imageUrl}
                        alt=""
                        width={1200}
                        height={675}
                        priority
                        className="aspect-video w-full rounded-xl border border-white/10 object-cover"
                    />
                )}

                {published && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        <time dateTime={String(post.publishedAt)}>{published}</time>
                    </div>
                )}

                <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">{post.title}</h1>

                <div className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-zinc-300 prose-a:text-gold-400 prose-a:no-underline hover:prose-a:text-gold-300 prose-strong:text-white prose-code:text-gold-300 prose-pre:border prose-pre:border-white/10 prose-pre:bg-zinc-900">
                    {Array.isArray(post.body) && <PortableText value={post.body} />}
                </div>
            </article>
        </>
    );
}
