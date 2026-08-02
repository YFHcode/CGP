'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

/**
 * Route-level error boundary. Without this, a throw in any server component
 * (a Sanity outage, a malformed payload) showed the raw Next.js error screen.
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[app] render error:', error);
    }, [error]);

    return (
        <div className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
            <AlertTriangle className="h-12 w-12 text-gold-400" aria-hidden="true" />
            <h1 className="mt-4 text-3xl font-bold text-white">Something went wrong</h1>
            <p className="mt-3 text-zinc-300">
                We hit an unexpected error loading this page. Trying again usually fixes it.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg bg-gold-500 px-5 py-2.5 font-medium text-black transition-colors hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    className="rounded-lg border border-white/10 px-5 py-2.5 font-medium text-zinc-200 transition-colors hover:border-gold-500/30 hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                >
                    Back to dashboard
                </Link>
            </div>

            {error.digest && (
                <p className="mt-6 text-xs text-zinc-500">Reference: {error.digest}</p>
            )}
        </div>
    );
}
