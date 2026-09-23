/**
 * What a chart actually draws, computed where the data already is.
 *
 * Every chart on this site used to receive the full daily record — 6,500+
 * points per metal, 26 years of closes — and throw almost all of it away in
 * the browser: the price charts plot at most 400 points, the indicator panels
 * the last 180, the trend and volatility charts 400. The discarded points
 * still went into every page's serialized payload, which is how /charts/gold
 * reached 3.9 MB and the homepage 830 KB.
 *
 * That payload is not free. Vercel bills an ISR read per 8 KB of page on
 * every edge-cache miss, and the free tier's million units were running out
 * at three times the allowance. A 3.9 MB page costs ~480 units per read; the
 * same chart drawn from a trimmed payload costs a handful.
 *
 * So the trimming moves here, and runs on the server. Each helper is the exact
 * operation the client component already performed, which is what makes it
 * safe: the browser re-applies the same step to data that has already been
 * through it, and gets the same answer — no chart looks any different.
 *
 * Free of runtime imports so node can run it directly under its TypeScript
 * stripping in scripts/chart-window.test.mjs.
 */

export type TimeRange = '1W' | '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX';

/**
 * Trailing window in calendar days. `null` means every point we hold.
 *
 * The multi-year windows exist because "10 year gold chart" and "silver price
 * over time" are recurring searches that a one-year maximum cannot answer.
 */
export const RANGE_DAYS: Record<TimeRange, number | null> = {
    '1W': 7,
    '1M': 30,
    '6M': 180,
    '1Y': 365,
    '5Y': 365 * 5,
    '10Y': 365 * 10,
    MAX: null,
};

export const RANGES = Object.keys(RANGE_DAYS) as TimeRange[];

/** The most points any line chart here draws. */
export const MAX_PLOTTED_POINTS = 400;

/** The trailing window the RSI, MACD and Bollinger panels draw. */
export const INDICATOR_WINDOW = 180;

/** The closes the forecast fan chart draws before its projection starts. */
export const FORECAST_TAIL = 40;

/**
 * How much recent history a range-switching chart ships up front.
 *
 * 365 *trading* days is about seventeen calendar months, so it holds every
 * point the 1W, 1M, 6M and 1Y views can select — date windows and tail
 * fallbacks alike — with room to spare. Only 5Y, 10Y and MAX need more, and
 * those are fetched on demand (see useFullHistory).
 */
export const RECENT_POINTS = 365;

/**
 * The longest range, in calendar days, that RECENT_POINTS covers exactly.
 * Anything longer, or unbounded, needs the full record.
 */
export const RECENT_RANGE_DAYS = 365;

/**
 * Evenly thins a series to at most `limit` points, always keeping the first
 * and last so the endpoints of the range stay accurate.
 *
 * The single definition. PriceChart, ExploreChart and InsightsCharts each had
 * an identical private copy, and the server-side trimming only reproduces the
 * client exactly because they are the same function.
 *
 * Idempotent: a series already at or under the limit comes back unchanged,
 * which is the property the whole approach rests on.
 */
export function downsample<T>(points: T[], limit: number = MAX_PLOTTED_POINTS): T[] {
    if (points.length <= limit) return points;

    const step = (points.length - 1) / (limit - 1);
    const thinned: T[] = [];
    for (let i = 0; i < limit; i += 1) {
        thinned.push(points[Math.round(i * step)]);
    }
    return thinned;
}

/**
 * Trims a series to the trailing window for a range.
 *
 * A sparse series (a few accumulated snapshots, or data gone stale) would
 * leave a date window nearly empty, so under two points it falls back to the
 * tail and something meaningful still draws.
 *
 * `now` is a parameter only so tests can pin it; the charts call it bare.
 */
export function sliceRange<T extends { date: string }>(
    points: T[],
    range: TimeRange,
    now: number = Date.now()
): T[] {
    if (points.length === 0) return [];

    const days = RANGE_DAYS[range];
    if (days === null) return points; // MAX — everything we hold

    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const windowed = points.filter((point) => {
        const time = new Date(point.date).getTime();
        return Number.isFinite(time) && time >= cutoff;
    });

    return windowed.length >= 2 ? windowed : points.slice(-days);
}

/** The last RECENT_POINTS of a series — what a range chart ships up front. */
export function recentTail<T>(series: T[]): T[] {
    return series.length <= RECENT_POINTS ? series : series.slice(-RECENT_POINTS);
}

/**
 * Props for a single-metal range chart: the recent tail, and which metal's
 * full record to fetch when a longer range is chosen.
 *
 * One helper rather than two props set separately, because the pair is only
 * correct together. A tail passed without `fullHistory` would quietly cap MAX
 * at seventeen months; a full series passed with it would fetch for nothing.
 * `fullHistory` is left off when the series was short enough to ship whole.
 */
export function rangeChartSeries<T, M extends string>(
    metal: M,
    series: T[]
): { series: T[]; fullHistory?: M } {
    return series.length > RECENT_POINTS
        ? { series: recentTail(series), fullHistory: metal }
        : { series };
}

/** The same for the two-metal charts, which fetch whichever metal is showing. */
export function rangeChartPair<T>(
    gold: T[],
    silver: T[]
): { gold: T[]; silver: T[]; fullHistory: boolean } {
    return {
        gold: recentTail(gold),
        silver: recentTail(silver),
        fullHistory: gold.length > RECENT_POINTS || silver.length > RECENT_POINTS,
    };
}

/**
 * Whether a range reaches past what recentTail holds.
 *
 * `null` is MAX. The comparison is strict: a 365-day window is exactly what
 * the tail was sized for.
 */
export function needsFullHistory(rangeDays: number | null): boolean {
    return rangeDays === null || rangeDays > RECENT_RANGE_DAYS;
}

/**
 * The drawable tail of an indicator series: nulls dropped (the warm-up period
 * at the start, before a 14-day RSI or a 26-day EMA has enough data), then
 * the last `window` points. Exactly the client's filter-then-slice.
 */
export function lastDrawn<T>(
    points: T[],
    isDrawable: (point: T) => boolean,
    window: number = INDICATOR_WINDOW
): T[] {
    return points.filter(isDrawable).slice(-window);
}

/**
 * The gold/silver ratio as RatioChart draws it: every `step`-th non-null
 * point, stepping so at most MAX_PLOTTED_POINTS remain.
 *
 * The mean comes back separately and is taken over the *full* record, because
 * that is what the chart's reference line has always shown. Computing it from
 * the thinned points would move the line — slightly, but it would move.
 */
export function thinRatio<T extends { value: number | null }>(
    points: T[]
): { points: T[]; mean: number | null } {
    const all = points.filter((p) => p.value !== null);
    if (all.length === 0) return { points: [], mean: null };

    const step = Math.max(1, Math.ceil(all.length / MAX_PLOTTED_POINTS));
    const mean = all.reduce((sum, p) => sum + (p.value as number), 0) / all.length;

    return { points: all.filter((_, i) => i % step === 0), mean };
}
