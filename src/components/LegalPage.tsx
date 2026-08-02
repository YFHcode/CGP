import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema } from '@/lib/seo';

interface LegalPageProps {
    title: string;
    /** Human-readable last-review date, e.g. "2 August 2026". */
    updated?: string;
    breadcrumb: { name: string; path: string };
    children: React.ReactNode;
}

/** Shared shell for the static content pages. */
export function LegalPage({ title, updated, breadcrumb, children }: LegalPageProps) {
    return (
        <>
            <JsonLd schema={breadcrumbSchema([breadcrumb])} />

            <div className="container mx-auto max-w-3xl px-4 py-12">
                <h1 className="mb-2 text-4xl font-bold text-white">{title}</h1>
                {updated && <p className="mb-8 text-sm text-zinc-400">Last updated: {updated}</p>}

                <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-zinc-300 prose-li:text-zinc-300 prose-a:text-gold-400 prose-a:no-underline hover:prose-a:text-gold-300 prose-strong:text-white">
                    {children}
                </div>
            </div>
        </>
    );
}
