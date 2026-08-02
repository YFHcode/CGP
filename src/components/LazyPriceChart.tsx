'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { PriceChart } from './PriceChart';

/**
 * Client-side loader for the price chart.
 *
 * recharts is ~328 KB and was shipping in the initial payload of every page
 * that imports the chart — including the ~1,000 single-day archive pages, which
 * render no chart at all because one data point is not a series.
 *
 * `ssr: false` costs nothing here: recharts renders through ResponsiveContainer,
 * which measures the DOM before drawing, so it emits no server HTML in any case.
 * The underlying numbers are already in the page as a table, so there is nothing
 * for a crawler to lose.
 */
const Chart = dynamic(() => import('./PriceChart').then((m) => m.PriceChart), {
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

export function LazyPriceChart(props: ComponentProps<typeof PriceChart>) {
    return <Chart {...props} />;
}
