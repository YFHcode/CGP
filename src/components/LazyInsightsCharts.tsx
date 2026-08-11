'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { TrendChart, VolatilityChart } from './InsightsCharts';

/** Same rationale as LazyPriceChart: keep recharts out of the initial payload. */
const ChartFallback = (
    <div className="h-[400px] w-full animate-pulse rounded-xl border border-white/10 bg-black/40" aria-hidden="true" />
);

const LazyTrendChart = dynamic(() => import('./InsightsCharts').then((m) => m.TrendChart), {
    ssr: false,
    loading: () => ChartFallback,
});

const LazyVolatilityChart = dynamic(() => import('./InsightsCharts').then((m) => m.VolatilityChart), {
    ssr: false,
    loading: () => ChartFallback,
});

export function LazyTrendChartWrapper(props: ComponentProps<typeof TrendChart>) {
    return <LazyTrendChart {...props} />;
}

export function LazyVolatilityChartWrapper(props: ComponentProps<typeof VolatilityChart>) {
    return <LazyVolatilityChart {...props} />;
}
