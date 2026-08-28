'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { RsiChart, MacdChart, BollingerChart, RatioChart } from './IndicatorCharts';

/**
 * Lazy loaders for the indicator panels, matching LazyPriceChart: recharts is
 * large and none of these render server HTML, so keeping them out of the
 * initial payload costs nothing.
 *
 * Each is loaded separately rather than as one bundle so a page that shows
 * only the ratio does not pull in the oscillators.
 */

const skeleton = () => (
    <section className="border-t border-white/5 py-8">
        <div className="container mx-auto px-4">
            <div
                className="h-56 w-full animate-pulse rounded-xl border border-white/10 bg-black/40"
                aria-hidden="true"
            />
        </div>
    </section>
);

const Rsi = dynamic(() => import('./IndicatorCharts').then((m) => m.RsiChart), {
    ssr: false,
    loading: skeleton,
});
const Macd = dynamic(() => import('./IndicatorCharts').then((m) => m.MacdChart), {
    ssr: false,
    loading: skeleton,
});
const Bollinger = dynamic(() => import('./IndicatorCharts').then((m) => m.BollingerChart), {
    ssr: false,
    loading: skeleton,
});
const Ratio = dynamic(() => import('./IndicatorCharts').then((m) => m.RatioChart), {
    ssr: false,
    loading: skeleton,
});

export function LazyRsiChart(props: ComponentProps<typeof RsiChart>) {
    return <Rsi {...props} />;
}
export function LazyMacdChart(props: ComponentProps<typeof MacdChart>) {
    return <Macd {...props} />;
}
export function LazyBollingerChart(props: ComponentProps<typeof BollingerChart>) {
    return <Bollinger {...props} />;
}
export function LazyRatioChart(props: ComponentProps<typeof RatioChart>) {
    return <Ratio {...props} />;
}
