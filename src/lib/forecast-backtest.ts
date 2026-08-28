import type { HistoryPoint } from '@/types';
import { forecast } from './forecast';

/**
 * Walk-forward evaluation of the forecast against the only benchmark that
 * matters.
 *
 * The benchmark is the random walk: "the price in h days is the price today".
 * For gold and silver that is a genuinely hard baseline — decades of research
 * find short-horizon precious metal prices close to a martingale — and any
 * model that cannot beat it has no skill, however sophisticated it looks.
 *
 * Publishing this alongside the forecast is the whole point. A projection
 * shown without its track record invites a reader to trust it; a projection
 * shown with a skill score of "about the same as assuming no change" tells
 * them what it is actually worth, which is the only defensible way to put a
 * price forecast in front of the public.
 *
 * Method is rolling-origin: step an origin through history, forecast from data
 * available at that origin only, compare with what actually happened. No point
 * after the origin is ever visible to the model, so this cannot leak the
 * future the way a naive in-sample fit would.
 */

export interface HorizonAccuracy {
    horizon: number;
    /** Mean absolute percentage error of the model. */
    modelMape: number;
    /** Mean absolute percentage error of carrying the last price forward. */
    naiveMape: number;
    /**
     * Model error divided by naive error. Below 1 means the model beat the
     * random walk; at or above 1 it did not.
     */
    skillRatio: number;
    /** Share of outcomes that fell inside the 80% interval, as a percentage. */
    coverage80Pct: number;
    /** Share of outcomes inside the 95% interval. */
    coverage95Pct: number;
    /** Number of origins evaluated at this horizon. */
    samples: number;
}

export interface BacktestResult {
    horizons: HorizonAccuracy[];
    /** Origins evaluated. */
    origins: number;
    /** Range of dates the evaluation covers. */
    from: string;
    to: string;
    /** True when the model beat the naive benchmark at every horizon. */
    beatsNaiveEverywhere: boolean;
    /** Mean skill ratio across horizons, for a one-number summary. */
    meanSkillRatio: number;
}

/** Minimum history before an origin can be evaluated. */
const MIN_TRAIN = 200;

/**
 * How many origins to evaluate. Bounded because this runs at render time over
 * a 6,000-point series, and every origin refits the model.
 */
const DEFAULT_ORIGINS = 180;

export function backtest(
    points: HistoryPoint[],
    horizon = 7,
    maxOrigins = DEFAULT_ORIGINS
): BacktestResult | null {
    if (!Array.isArray(points) || points.length < MIN_TRAIN + horizon + 10) return null;

    // Accumulators per horizon, 1-based.
    const modelErr: number[][] = Array.from({ length: horizon }, () => []);
    const naiveErr: number[][] = Array.from({ length: horizon }, () => []);
    const in80: number[] = Array(horizon).fill(0);
    const in95: number[] = Array(horizon).fill(0);
    const counts: number[] = Array(horizon).fill(0);

    const lastOrigin = points.length - horizon - 1;
    const firstOrigin = Math.max(MIN_TRAIN, lastOrigin - maxOrigins + 1);
    if (firstOrigin > lastOrigin) return null;

    let origins = 0;

    for (let origin = firstOrigin; origin <= lastOrigin; origin++) {
        const train = points.slice(0, origin + 1);
        const result = forecast(train, horizon);
        if (!result) continue;

        const lastKnown = train[train.length - 1].close;
        origins++;

        for (let h = 1; h <= horizon; h++) {
            const actual = points[origin + h];
            const predicted = result.points[h - 1];
            if (!actual || !predicted || !(actual.close > 0)) continue;

            modelErr[h - 1].push(Math.abs(predicted.expected - actual.close) / actual.close);
            naiveErr[h - 1].push(Math.abs(lastKnown - actual.close) / actual.close);

            if (actual.close >= predicted.low80 && actual.close <= predicted.high80) in80[h - 1]++;
            if (actual.close >= predicted.low95 && actual.close <= predicted.high95) in95[h - 1]++;
            counts[h - 1]++;
        }
    }

    if (origins === 0) return null;

    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    const horizons: HorizonAccuracy[] = [];
    for (let h = 1; h <= horizon; h++) {
        const m = mean(modelErr[h - 1]) * 100;
        const n = mean(naiveErr[h - 1]) * 100;
        horizons.push({
            horizon: h,
            modelMape: m,
            naiveMape: n,
            // Guard the degenerate case where the naive error is zero, which
            // would otherwise report Infinity skill.
            skillRatio: n > 0 ? m / n : 1,
            coverage80Pct: counts[h - 1] ? (in80[h - 1] / counts[h - 1]) * 100 : 0,
            coverage95Pct: counts[h - 1] ? (in95[h - 1] / counts[h - 1]) * 100 : 0,
            samples: counts[h - 1],
        });
    }

    return {
        horizons,
        origins,
        from: points[firstOrigin].date,
        to: points[lastOrigin].date,
        beatsNaiveEverywhere: horizons.every((h) => h.skillRatio < 1),
        meanSkillRatio: mean(horizons.map((h) => h.skillRatio)),
    };
}

/**
 * One plain-English sentence describing what the backtest found, for display
 * next to the forecast. Deliberately blunt in the common case.
 */
export function describeSkill(result: BacktestResult | null): string {
    if (!result) return 'Not enough history to measure this model against a benchmark.';

    const ratio = result.meanSkillRatio;
    const pct = Math.abs((1 - ratio) * 100).toFixed(0);

    if (ratio < 0.97) {
        return (
            `Across ${result.origins} historical starting points, this projection was about ` +
            `${pct}% more accurate than simply assuming the price would not change.`
        );
    }
    if (ratio > 1.03) {
        return (
            `Across ${result.origins} historical starting points, this projection was about ` +
            `${pct}% less accurate than simply assuming the price would not change. Treat the ` +
            `central line as decoration and read the range instead.`
        );
    }
    return (
        `Across ${result.origins} historical starting points, this projection was no more ` +
        `accurate than simply assuming the price would not change — which is what a week-ahead ` +
        `metals forecast usually is. The useful part of this page is the range, not the line.`
    );
}
