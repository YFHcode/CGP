import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

import { ARCHIVE_NAV, MAIN_NAV, RESOURCE_NAV, TOOLS_NAV, SITE_NAME } from '@/lib/navigation';

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-zinc-950">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-6">
                    <div className="col-span-1 md:col-span-2">
                        <div className="mb-4 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600">
                                <TrendingUp className="h-5 w-5 text-black" aria-hidden="true" />
                            </div>
                            <span className="text-xl font-bold text-white">
                                Chart<span className="text-gold-400">Gold</span>Price
                            </span>
                        </div>
                        <p className="max-w-md text-sm text-zinc-300">
                            Gold and silver spot prices with historical charts, a karat-aware value
                            calculator and market news, in eight currencies.
                        </p>
                    </div>

                    <nav aria-labelledby="footer-nav-heading">
                        <h2 id="footer-nav-heading" className="mb-4 font-semibold text-white">
                            Quick links
                        </h2>
                        <ul className="space-y-2 text-sm">
                            {MAIN_NAV.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="rounded text-zinc-300 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav aria-labelledby="footer-tools-heading">
                        <h2 id="footer-tools-heading" className="mb-4 font-semibold text-white">
                            Prices &amp; tools
                        </h2>
                        <ul className="space-y-2 text-sm">
                            {TOOLS_NAV.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="rounded text-zinc-300 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav aria-labelledby="footer-archive-heading">
                        <h2 id="footer-archive-heading" className="mb-4 font-semibold text-white">
                            Archives
                        </h2>
                        <ul className="space-y-2 text-sm">
                            {ARCHIVE_NAV.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="rounded text-zinc-300 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <nav aria-labelledby="footer-resources-heading">
                        <h2 id="footer-resources-heading" className="mb-4 font-semibold text-white">
                            Resources
                        </h2>
                        <ul className="space-y-2 text-sm">
                            {RESOURCE_NAV.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="rounded text-zinc-300 transition-colors hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                <div className="mt-8 border-t border-white/10 pt-8">
                    <p className="mb-4 text-xs leading-relaxed text-zinc-400">
                        <strong className="text-zinc-300">Disclaimer:</strong> {SITE_NAME} provides
                        precious-metal price information for general reference only. Prices are
                        sourced from third parties, may be delayed, and are not guaranteed to be
                        accurate or suitable for trading. Nothing on this site is financial,
                        investment or tax advice. Always confirm prices with your dealer or broker
                        before transacting.
                    </p>
                    <p className="text-sm text-zinc-400">
                        © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
