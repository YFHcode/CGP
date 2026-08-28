import type { HistoryPoint, GoldPriceResponse } from '@/types';
import { computeDayProfile } from './day-character';
import { leadBlock } from './day-narrative';
import { goldSilverRatio, rsi, latest } from './indicators';
import { forecast } from './forecast';
import { describeCoverage } from './coverage';

/**
 * Everything the homepage needs to say something specific, computed once on
 * the server.
 *
 * The homepage had grown stale relative to the site: it showed two metals and
 * six links while the site had four metals, a 26-year daily archive, forecasts,
 * technical indicators and roughly fifteen tools. Worse, it showed only the
 * current price — a number a visitor can get from a search result without
 * clicking — and nothing that required actually having the data.
 *
 * So this assembles the things that do require it: where today sits in the
 * record, where the gold-silver ratio sits against its own history, how far
 * each metal is from its 52-week extremes. Every figure comes from an existing
 * tested library rather than a new calculation, so the homepage cannot drift
 * away from the pages it summarises.
 */

export interface RangePosition {
    /** 0 at the 52-week low, 1 at the 52-week high. Null if not computable. */
    position: number;
    low: number;
    high: number;
}

export interface HomeInsights {
    /** Plain-language read on the most recent gold session. */
    todaysRead: { heading: string; body: string } | null;
    /** Current gold-to-silver ratio and where it sits historically. */
    ratio: { current: number; percentile: number; median: number } | null;
    goldRsi: number | null;
    goldRange52: RangePosition | null;
    silverRange52: RangePosition | null;
    /** Seven-day 80% range for gold, for the forecast teaser. */
    goldForecast: { low: number; high: number; days: number } | null;
    /** How much history the site actually holds, for the credibility line. */
    coverage: { sentence: string; points: number; years: number } | null;
}

const SESSIONS_PER_YEAR = 252;

function rangePosition(series: HistoryPoint[], current: number): RangePosition | null {
    const window = series.slice(-SESSIONS_PER_YEAR).map((p) => p.close).filter((c) => c > 0);
    if (window.length < 30 || !(current > 0)) return null;

    const low = Math.min(...window);
    const high = Math.max(...window);
    if (high <= low) return null;

    // Clamped: a live price can sit outside the window of closes it is being
    // compared against, and a bar rendered at 118% would look like a bug.
    const raw = (current - low) / (high - low);
    return { position: Math.min(1, Math.max(0, raw)), low, high };
}

export function computeHomeInsights(
    goldQuote: GoldPriceResponse | null,
    silverQuote: GoldPriceResponse | null,
    goldSeries: HistoryPoint[],
    silverSeries: HistoryPoint[]
): HomeInsights {
    const lastGold = goldSeries[goldSeries.length - 1];

    const profile = lastGold ? computeDayProfile(goldSeries, lastGold.date) : null;
    const lead = profile ? leadBlock(profile, 'Gold') : null;

    // Ratio percentile over the whole record: "68" means the ratio has been
    // lower than today on 68% of days ever recorded, which is the framing that
    // makes a bare ratio meaningful.
    let ratio: HomeInsights['ratio'] = null;
    const ratioSeries = goldSilverRatio(goldSeries, silverSeries);
    if (ratioSeries.length > 100 && goldQuote && silverQuote && silverQuote.price > 0) {
        const current = goldQuote.price / silverQuote.price;
        const values = ratioSeries.map((p) => p.value as number).sort((a, b) => a - b);
        const below = values.filter((v) => v < current).length;
        ratio = {
            current,
            percentile: (below / values.length) * 100,
            median: values[Math.floor(values.length / 2)],
        };
    }

    const goldForecastResult = forecast(goldSeries, 7);
    const lastForecast = goldForecastResult?.points[goldForecastResult.points.length - 1] ?? null;

    const facts = describeCoverage(goldSeries);
    const years =
        facts && facts.start && facts.end
            ? Math.floor(
                  (Date.parse(facts.end) - Date.parse(facts.start)) / (365.25 * 86_400_000)
              )
            : 0;

    return {
        todaysRead: lead ? { heading: lead.heading, body: lead.body } : null,
        ratio,
        goldRsi: latest(rsi(goldSeries)),
        goldRange52: goldQuote ? rangePosition(goldSeries, goldQuote.price) : null,
        silverRange52: silverQuote ? rangePosition(silverSeries, silverQuote.price) : null,
        goldForecast: lastForecast
            ? { low: lastForecast.low80, high: lastForecast.high80, days: 7 }
            : null,
        coverage: facts ? { sentence: facts.sentence, points: facts.points, years } : null,
    };
}
