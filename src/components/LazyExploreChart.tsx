'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { ExploreChart } from './ExploreChart';

/** Same rationale as LazyPriceChart: keep recharts out of the initial payload. */
const Chart = dynamic(() => import('./ExploreChart').then((m) => m.ExploreChart), {
    ssr: false,
    loading: () => (
        <section className="border-y border-white/5 bg-zinc-900/30 py-12">
            <div className="container mx-auto px-4">
                <div
                    className="h-[400px] w-full animate-pulse rounded-xl border border-white/10 bg-black/40"
                    aria-hidden="true"
                />
            </div>
        </section>
    ),
});

export function LazyExploreChart(props: ComponentProps<typeof ExploreChart>) {
    return <Chart {...props} />;
}
