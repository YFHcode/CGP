'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { ForecastChart } from './ForecastChart';

/**
 * Client-side loader for the fan chart, for the same reason as
 * LazyPriceChart: recharts is large and should not sit in the initial payload.
 * The numbers are also rendered as a table on the page, so nothing a crawler
 * needs depends on this component.
 */
const Chart = dynamic(() => import('./ForecastChart').then((m) => m.ForecastChart), {
    ssr: false,
    loading: () => (
        <div
            className="h-80 w-full animate-pulse rounded-xl border border-white/10 bg-black/40"
            aria-hidden="true"
        />
    ),
});

export function LazyForecastChart(props: ComponentProps<typeof ForecastChart>) {
    return <Chart {...props} />;
}
