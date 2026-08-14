'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Menu, X, ChevronDown } from 'lucide-react';

import { CurrencySelector } from './CurrencySelector';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from '@/lib/navigation';

/**
 * Site header with grouped navigation.
 *
 * The previous version was a flat list that only ever showed eight links;
 * everything else — per-unit pages, per-currency pages, silver history, the
 * silver calculator — was reachable only by scrolling to the footer. Grouping
 * puts roughly twenty-five destinations two clicks from anywhere while
 * keeping the bar itself shorter than it was.
 */
export function Header() {
    const [isOpen, setIsOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
    const pathname = usePathname();
    const navRef = useRef<HTMLDivElement>(null);

    const isCurrent = (href: string) =>
        href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

    /** A group is "current" when the page sits under any of its links. */
    const isGroupCurrent = (label: string) => {
        const group = NAV_GROUPS.find((g) => g.label === label);
        return Boolean(
            group?.sections.some((section) => section.links.some((link) => isCurrent(link.href)))
        );
    };

    // Close the desktop dropdown on outside click or Escape.
    useEffect(() => {
        if (!openGroup) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenGroup(null);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [openGroup]);

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
                        <div ref={navRef} className="hidden items-center gap-1 lg:flex">
                            <nav aria-label="Main" className="flex items-center gap-1">
                                {NAV_GROUPS.map((group) => {
                                    const open = openGroup === group.label;
                                    return (
                                        <div key={group.label} className="relative">
                                            <button
                                                type="button"
                                                aria-expanded={open}
                                                aria-haspopup="true"
                                                onClick={() =>
                                                    setOpenGroup(open ? null : group.label)
                                                }
                                                className={cn(
                                                    'flex items-center gap-1 rounded px-3 py-2 text-sm font-medium transition-colors',
                                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                                    isGroupCurrent(group.label) || open
                                                        ? 'text-gold-400'
                                                        : 'text-zinc-300 hover:text-gold-300'
                                                )}
                                            >
                                                {group.label}
                                                <ChevronDown
                                                    className={cn(
                                                        'h-4 w-4 transition-transform',
                                                        open && 'rotate-180'
                                                    )}
                                                    aria-hidden="true"
                                                />
                                            </button>

                                            {/* Always rendered, hidden with CSS rather than
                                                conditionally mounted: a link that only exists
                                                after a click is not in the HTML, so crawlers
                                                never see it. Hidden navigation is standard and
                                                explicitly fine; unmounted navigation is not. */}
                                            <div
                                                className={cn(
                                                    'absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl',
                                                    !open && 'hidden'
                                                )}
                                            >
                                                    {group.sections.map((section) => (
                                                        <div key={section.title} className="py-1">
                                                            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                                                {section.title}
                                                            </p>
                                                            <ul>
                                                                {section.links.map((link) => (
                                                                    <li key={link.href}>
                                                                        <Link
                                                                            href={link.href}
                                                                            onClick={() => setOpenGroup(null)}
                                                                            aria-current={
                                                                                isCurrent(link.href)
                                                                                    ? 'page'
                                                                                    : undefined
                                                                            }
                                                                            className={cn(
                                                                                'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                                                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                                                                isCurrent(link.href)
                                                                                    ? 'bg-white/5 text-gold-300'
                                                                                    : 'text-zinc-200 hover:bg-white/5 hover:text-gold-300'
                                                                            )}
                                                                        >
                                                                            {link.label}
                                                                        </Link>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

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
                    <nav
                        id="mobile-nav"
                        aria-label="Main"
                        className="max-h-[70vh] space-y-1 overflow-y-auto pb-4 lg:hidden"
                    >
                        {NAV_GROUPS.map((group) => {
                            const expanded = openMobileGroup === group.label;
                            return (
                                <div key={group.label} className="border-b border-white/5 last:border-0">
                                    <button
                                        type="button"
                                        aria-expanded={expanded}
                                        onClick={() =>
                                            setOpenMobileGroup(expanded ? null : group.label)
                                        }
                                        className={cn(
                                            'flex w-full items-center justify-between rounded px-2 py-3 text-left text-base font-medium transition-colors',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                            isGroupCurrent(group.label)
                                                ? 'text-gold-400'
                                                : 'text-zinc-200'
                                        )}
                                    >
                                        {group.label}
                                        <ChevronDown
                                            className={cn(
                                                'h-5 w-5 shrink-0 transition-transform',
                                                expanded && 'rotate-180'
                                            )}
                                            aria-hidden="true"
                                        />
                                    </button>

                                    <div className={cn('pb-2', !expanded && 'hidden')}>
                                            {group.sections.map((section) => (
                                                <div key={section.title} className="mb-2">
                                                    <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                                        {section.title}
                                                    </p>
                                                    <ul>
                                                        {section.links.map((link) => (
                                                            <li key={link.href}>
                                                                <Link
                                                                    href={link.href}
                                                                    onClick={() => {
                                                                        setIsOpen(false);
                                                                        setOpenMobileGroup(null);
                                                                    }}
                                                                    aria-current={
                                                                        isCurrent(link.href)
                                                                            ? 'page'
                                                                            : undefined
                                                                    }
                                                                    className={cn(
                                                                        'block rounded px-4 py-2 text-sm transition-colors',
                                                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                                                                        isCurrent(link.href)
                                                                            ? 'text-gold-300'
                                                                            : 'text-zinc-300 hover:text-gold-300'
                                                                    )}
                                                                >
                                                                    {link.label}
                                                                </Link>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            );
                        })}
                    </nav>
                )}
            </div>
        </header>
    );
}
