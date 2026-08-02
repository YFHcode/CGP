'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Menu, X } from 'lucide-react';

import { CurrencySelector } from './CurrencySelector';
import { cn } from '@/lib/utils';
import { MAIN_NAV } from '@/lib/navigation';

export function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const isCurrent = (href: string) =>
        href === '/' ? pathname === '/' : pathname.startsWith(href);

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-xl">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:font-medium focus:text-black"
            >
                Skip to content
            </a>

            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
                            <TrendingUp className="h-5 w-5 text-black" aria-hidden="true" />
                        </div>
                        <span className="text-xl font-bold text-white">
                            Chart<span className="text-gold-400">Gold</span>Price
                        </span>
                    </Link>

                    <div className="flex items-center gap-4">
                        {/* Collapses at lg, not md: seven links plus the currency
                            picker were cramped in the 768–1024px band. */}
                        <nav
                            aria-label="Main"
                            className="hidden items-center gap-6 text-sm font-medium lg:flex"
                        >
                            {MAIN_NAV.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-current={isCurrent(link.href) ? 'page' : undefined}
                                    className={cn(
                                        'rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                        isCurrent(link.href)
                                            ? 'text-gold-400'
                                            : 'text-zinc-300 hover:text-gold-300'
                                    )}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        <CurrencySelector />

                        <button
                            type="button"
                            onClick={() => setIsOpen((open) => !open)}
                            aria-expanded={isOpen}
                            aria-controls="mobile-nav"
                            aria-label={isOpen ? 'Close menu' : 'Open menu'}
                            className="rounded p-2 text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 lg:hidden"
                        >
                            {isOpen ? (
                                <X className="h-6 w-6" aria-hidden="true" />
                            ) : (
                                <Menu className="h-6 w-6" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>

                {isOpen && (
                    <nav id="mobile-nav" aria-label="Main" className="space-y-1 pb-4 lg:hidden">
                        {MAIN_NAV.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-current={isCurrent(link.href) ? 'page' : undefined}
                                // Close on navigation. Doing this here rather
                                // than in a pathname effect avoids a cascading
                                // re-render on every route change.
                                onClick={() => setIsOpen(false)}
                                className={cn(
                                    'block rounded px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                    isCurrent(link.href)
                                        ? 'text-gold-400'
                                        : 'text-zinc-300 hover:text-gold-300'
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>
        </header>
    );
}
