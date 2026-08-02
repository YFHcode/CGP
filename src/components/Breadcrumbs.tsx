import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
    name: string;
    href: string;
}

/**
 * Visible breadcrumb trail.
 *
 * The site already emitted BreadcrumbList JSON-LD, but Google prefers the
 * markup to be backed by links users can actually see and follow. It also adds
 * a keyword-rich internal link to every parent page from every child.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
    if (trail.length === 0) return null;

    return (
        <nav aria-label="Breadcrumb" className="border-b border-white/5 bg-black/40">
            <div className="container mx-auto px-4 py-3">
                <ol className="flex flex-wrap items-center gap-1 text-sm">
                    <li className="flex items-center gap-1">
                        <Link
                            href="/"
                            className="rounded text-zinc-300 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                        >
                            Home
                        </Link>
                    </li>
                    {trail.map((crumb, index) => {
                        const isLast = index === trail.length - 1;
                        return (
                            <li key={crumb.href} className="flex items-center gap-1">
                                <ChevronRight
                                    className="h-4 w-4 shrink-0 text-zinc-500"
                                    aria-hidden="true"
                                />
                                {isLast ? (
                                    <span className="text-zinc-100" aria-current="page">
                                        {crumb.name}
                                    </span>
                                ) : (
                                    <Link
                                        href={crumb.href}
                                        className="rounded text-zinc-300 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                    >
                                        {crumb.name}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </nav>
    );
}
