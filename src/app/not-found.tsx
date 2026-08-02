import Link from 'next/link';
import { MAIN_NAV } from '@/lib/navigation';

/** Styled 404. The default Next.js page dropped users out of the dark theme. */
export default function NotFound() {
    return (
        <div className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
            <p className="text-7xl font-bold text-gold-400">404</p>
            <h1 className="mt-4 text-3xl font-bold text-white">Page not found</h1>
            <p className="mt-3 text-zinc-300">
                The page you&apos;re looking for doesn&apos;t exist or has moved.
            </p>

            <nav aria-label="Suggested pages" className="mt-8 flex flex-wrap justify-center gap-3">
                {MAIN_NAV.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-lg border border-white/10 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-gold-500/30 hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
