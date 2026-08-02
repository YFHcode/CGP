/**
 * Skeleton shown while a route segment streams in.
 *
 * Shaped like the price cards it replaces so the layout doesn't shift when real
 * content arrives.
 */
export default function Loading() {
    return (
        <div className="container mx-auto px-4 py-16" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading…</span>

            <div className="mx-auto mb-12 max-w-2xl space-y-4 text-center">
                <div className="mx-auto h-12 w-3/4 animate-pulse rounded-lg bg-white/5" />
                <div className="mx-auto h-5 w-full animate-pulse rounded bg-white/5" />
            </div>

            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
                {[0, 1].map((index) => (
                    <div
                        key={index}
                        className="rounded-xl border border-white/10 bg-zinc-900/50 p-6"
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <div className="h-10 w-10 animate-pulse rounded-lg bg-white/5" />
                            <div className="space-y-2">
                                <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
                                <div className="h-3 w-28 animate-pulse rounded bg-white/5" />
                            </div>
                        </div>
                        <div className="mb-3 h-8 animate-pulse rounded-lg bg-white/5" />
                        <div className="h-10 w-2/3 animate-pulse rounded bg-white/5" />
                    </div>
                ))}
            </div>
        </div>
    );
}
