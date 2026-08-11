import type { PeriodStats } from './history-periods';
import { METAL_ROUTES, formatLongDate } from './history-periods';
import type { PeriodInsights } from './period-insights';
import type { MetalSymbol } from '@/types';

/**
 * Question-and-answer content for period pages.
 *
 * This is where long-tail search intent is targeted — "what was the price of
 * gold in March 2026", "how did gold perform in 2025", "what was the highest
 * gold price last year". Those phrasings belong in headings and body copy that
 * genuinely answer them, not in the URL: rotating keyword templates through
 * slugs is the scaled-content-abuse pattern Google penalises, and words in URLs
 * are only a weak ranking signal in the first place.
 *
 * Every answer is generated from real figures, so no page claims anything the
 * data does not support.
 */

export interface PeriodQuestion {
    question: string;
    answer: string;
}

function usd(value: number): string {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function direction(change: number): 'rose' | 'fell' | 'was unchanged' {
    if (change > 0) return 'rose';
    if (change < 0) return 'fell';
    return 'was unchanged';
}

/** Past participle for use after "has"/"having" — "has rose" is not English. */
function directionPerfect(change: number): 'risen' | 'fallen' | 'been unchanged' {
    if (change > 0) return 'risen';
    if (change < 0) return 'fallen';
    return 'been unchanged';
}

/**
 * Builds the Q&A set for a period.
 *
 * Phrasing varies by period kind so each question reads naturally — a day page
 * asks "what was the price on", a month page "how did it perform in" — rather
 * than cycling synonyms of the same question, which would read as generated.
 */
export function periodQuestions(
    metal: MetalSymbol,
    stats: PeriodStats,
    insights?: PeriodInsights
): PeriodQuestion[] {
    const name = METAL_ROUTES[metal].name;
    const lower = name.toLowerCase();
    const { period } = stats;
    const label = period.label;
    const questions: PeriodQuestion[] = [];

    if (period.kind === 'day') {
        questions.push({
            question: `What was the price of ${lower} on ${label}?`,
            answer:
                `${name} closed at ${usd(stats.close)} per troy ounce on ${label}. ` +
                (stats.previousClose !== null
                    ? `That is ${usd(Math.abs(stats.change))} ${
                          stats.change >= 0 ? 'higher' : 'lower'
                      } than the previous close of ${usd(stats.previousClose)}, a move of ${stats.changePct.toFixed(2)}%.`
                    : 'This is the earliest close in our records for this metal.'),
        });

        if (stats.previousClose !== null) {
            questions.push({
                question: `Did the ${lower} price go up or down on ${label}?`,
                answer:
                    `The ${lower} price ${direction(stats.change)} on ${label}, ` +
                    `${stats.change >= 0 ? 'gaining' : 'losing'} ${usd(Math.abs(stats.change))} ` +
                    `(${Math.abs(stats.changePct).toFixed(2)}%) against the previous session's close of ` +
                    `${usd(stats.previousClose)}.`,
            });
        }

        questions.push({
            question: `How much was one gram of ${lower} on ${label}?`,
            answer:
                `At ${usd(stats.close)} per troy ounce, one gram of pure ${lower} was worth about ` +
                `${usd(stats.close / 31.1034768)} on ${label}. A troy ounce is 31.1034768 grams.`,
        });

        if (insights) {
            if (metal === 'XAU') {
                const k18 = insights.perGramByKarat.find((k) => k.karat === '18K');
                const k14 = insights.perGramByKarat.find((k) => k.karat === '14K');
                if (k18 && k14) {
                    questions.push({
                        question: `What was 14k and 18k gold worth per gram on ${label}?`,
                        answer:
                            `Scrap value follows purity, so on ${label} 18k gold was worth about ` +
                            `${usd(k18.value)} per gram and 14k about ${usd(k14.value)} per gram, ` +
                            `against ${usd(insights.perGram)} for pure 24k. These are melt values ` +
                            `before any dealer margin.`,
                    });
                }
            }

            if (insights.ratioClose !== null) {
                questions.push({
                    question: `What was the gold to silver ratio on ${label}?`,
                    answer:
                        `The gold-to-silver ratio closed at about ` +
                        `${insights.ratioClose.toFixed(1)} on ${label}, meaning one ounce of gold ` +
                        `was worth roughly ${insights.ratioClose.toFixed(1)} ounces of silver.`,
                });
            }

            if (insights.yearAgoClose !== null && insights.yearAgoChangePct !== null) {
                questions.push({
                    question: `How did the ${lower} price on ${label} compare with a year earlier?`,
                    answer:
                        `A year before ${label}, ${lower} was around ` +
                        `${usd(insights.yearAgoClose)} per troy ounce. The close of ` +
                        `${usd(stats.close)} therefore represents a ` +
                        `${insights.yearAgoChangePct >= 0 ? 'rise' : 'fall'} of ` +
                        `${Math.abs(insights.yearAgoChangePct).toFixed(1)}% over twelve months.`,
                });
            }
        }

        return questions;
    }

    // Month and year share the same question shapes.
    const span = period.kind === 'year' ? 'year' : 'month';
    const complete = stats.isComplete;
    // "so far" / "to date" qualifiers so an in-progress month or year is never
    // described as settled — the period is still accumulating data.
    const soFar = complete ? '' : ' so far';
    const toDate = complete ? '' : ' to date';
    const asOf = complete ? '' : ` (through ${formatLongDate(stats.points[stats.points.length - 1].date)})`;

    questions.push({
        question: `How did ${lower} perform in ${label}?`,
        answer:
            `${name} ${complete ? `finished ${label} at` : `is at`} ${usd(stats.close)} per troy ounce${soFar}, having ` +
            `${directionPerfect(stats.change)} ${
                stats.change !== 0 ? `${usd(Math.abs(stats.change))} (${Math.abs(stats.changePct).toFixed(2)}%) ` : ''
            }over the ${span}${toDate}. It has traded between ${usd(stats.low)} and ${usd(stats.high)} across ` +
            `${stats.points.length} trading ${stats.points.length === 1 ? 'day' : 'days'}${soFar}${asOf}.`,
    });

    questions.push({
        question: `What was the average ${lower} price in ${label}?`,
        answer:
            `The average ${lower} closing price in ${label}${soFar} was ${usd(stats.average)} per troy ounce, ` +
            `calculated across all ${stats.points.length} trading ${
                stats.points.length === 1 ? 'day' : 'days'
            } in the ${span}${soFar}${asOf}.`,
    });

    questions.push({
        question: `What was the highest ${lower} price in ${label}?`,
        answer:
            `${name} reached its highest close ${complete ? `of ${label}` : `of ${label}${soFar}`} at ${usd(stats.high)} per troy ounce on ` +
            `${formatLongDate(stats.highDate)}.`,
    });

    questions.push({
        question: `What was the lowest ${lower} price in ${label}?`,
        answer:
            `The lowest ${lower} close in ${label}${soFar} was ${usd(stats.low)} per troy ounce on ` +
            `${formatLongDate(stats.lowDate)}.`,
    });

    if (stats.previousClose !== null) {
        questions.push({
            question: `Did ${lower} go up or down in ${label}?`,
            answer:
                `${name} ${complete ? direction(stats.change) : `has ${directionPerfect(stats.change)} so far`} during ${label}. It entered the ${span} at ` +
                `${usd(stats.previousClose)} and ${complete ? 'closed' : 'is currently'} at ${usd(stats.close)}, a change of ` +
                `${stats.changePct.toFixed(2)}%.`,
        });
    }

    if (insights) {
        if (insights.upDays + insights.downDays > 0) {
            questions.push({
                question: `How many days did ${lower} rise in ${label}?`,
                answer:
                    `${name} closed higher on ${insights.upDays} ` +
                    `${insights.upDays === 1 ? 'session' : 'sessions'} and lower on ` +
                    `${insights.downDays} during ${label}${soFar}` +
                    (insights.bestDay && insights.worstDay
                        ? `. The strongest session ${complete ? 'was' : 'so far was'} ${formatLongDate(insights.bestDay.date)} ` +
                          `(${insights.bestDay.pct >= 0 ? '+' : ''}${insights.bestDay.pct.toFixed(2)}%) ` +
                          `and the weakest ${formatLongDate(insights.worstDay.date)} ` +
                          `(${insights.worstDay.pct.toFixed(2)}%)`
                        : '') +
                    `.`,
            });
        }

        questions.push({
            question: `How volatile was ${lower} in ${label}?`,
            answer:
                `Daily closes in ${label}${soFar} varied with a standard deviation of ` +
                `${insights.volatilityPct.toFixed(2)}% per session, and the peak-to-trough spread ` +
                `across the ${span}${soFar} was ${insights.rangePct.toFixed(1)}% ` +
                `(${usd(stats.low)} to ${usd(stats.high)}).`,
        });

        questions.push({
            question: `What was the ${lower} price per gram and per kilo in ${label}?`,
            answer:
                `At the ${complete ? `${label} close` : `latest ${label} price`} of ${usd(stats.close)} per troy ounce, ${lower} worked out ` +
                `at about ${usd(insights.perGram)} per gram and ${usd(insights.perKilo)} per ` +
                `kilogram. A troy ounce is 31.1034768 grams.`,
        });

        if (insights.ratioAverage !== null && insights.ratioClose !== null) {
            questions.push({
                question: `What was the gold to silver ratio in ${label}?`,
                answer:
                    `The gold-to-silver ratio averaged about ${insights.ratioAverage.toFixed(1)} ` +
                    `through ${label}${soFar} and ${complete ? 'finished' : 'stands'} the ${span} near ` +
                    `${insights.ratioClose.toFixed(1)}. A higher ratio means silver is cheap ` +
                    `relative to gold.`,
            });
        }

        if (insights.yearAgoClose !== null && insights.yearAgoChangePct !== null) {
            questions.push({
                question: `How does ${label} compare with the same period a year earlier?`,
                answer:
                    `${name} was around ${usd(insights.yearAgoClose)} per troy ounce twelve months ` +
                    `before ${complete ? 'the end of' : 'the latest price in'} ${label}. ` +
                    `${complete ? 'Closing' : 'Trading'} at ${usd(stats.close)} makes that a ` +
                    `${insights.yearAgoChangePct >= 0 ? 'gain' : 'decline'} of ` +
                    `${Math.abs(insights.yearAgoChangePct).toFixed(1)}% year on year.`,
            });
        }
    }

    return questions;
}

/**
 * FAQPage structured data.
 *
 * Note that Google restricted FAQ rich results to authoritative government and
 * health sites in 2023, so this is unlikely to produce the expandable snippet.
 * It is included because the markup still describes the page accurately and
 * costs nothing; the ranking value comes from the visible questions and
 * answers, which match how people actually phrase these searches.
 */
export function periodFaqSchema(questions: PeriodQuestion[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: questions.map((entry) => ({
            '@type': 'Question',
            name: entry.question,
            acceptedAnswer: { '@type': 'Answer', text: entry.answer },
        })),
    };
}
