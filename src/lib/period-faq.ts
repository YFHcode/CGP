import type { PeriodStats } from './history-periods';
import { METAL_ROUTES, formatLongDate } from './history-periods';
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

/**
 * Builds the Q&A set for a period.
 *
 * Phrasing varies by period kind so each question reads naturally — a day page
 * asks "what was the price on", a month page "how did it perform in" — rather
 * than cycling synonyms of the same question, which would read as generated.
 */
export function periodQuestions(metal: MetalSymbol, stats: PeriodStats): PeriodQuestion[] {
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

        return questions;
    }

    // Month and year share the same question shapes.
    const span = period.kind === 'year' ? 'year' : 'month';

    questions.push({
        question: `How did ${lower} perform in ${label}?`,
        answer:
            `${name} finished ${label} at ${usd(stats.close)} per troy ounce, having ` +
            `${direction(stats.change)} ${
                stats.change !== 0 ? `${usd(Math.abs(stats.change))} (${Math.abs(stats.changePct).toFixed(2)}%) ` : ''
            }over the ${span}. It traded between ${usd(stats.low)} and ${usd(stats.high)} across ` +
            `${stats.points.length} trading ${stats.points.length === 1 ? 'day' : 'days'}.`,
    });

    questions.push({
        question: `What was the average ${lower} price in ${label}?`,
        answer:
            `The average ${lower} closing price in ${label} was ${usd(stats.average)} per troy ounce, ` +
            `calculated across all ${stats.points.length} trading ${
                stats.points.length === 1 ? 'day' : 'days'
            } in the ${span}.`,
    });

    questions.push({
        question: `What was the highest ${lower} price in ${label}?`,
        answer:
            `${name} reached its highest close of ${label} at ${usd(stats.high)} per troy ounce on ` +
            `${formatLongDate(stats.highDate)}.`,
    });

    questions.push({
        question: `What was the lowest ${lower} price in ${label}?`,
        answer:
            `The lowest ${lower} close in ${label} was ${usd(stats.low)} per troy ounce on ` +
            `${formatLongDate(stats.lowDate)}.`,
    });

    if (stats.previousClose !== null) {
        questions.push({
            question: `Did ${lower} go up or down in ${label}?`,
            answer:
                `${name} ${direction(stats.change)} during ${label}. It entered the ${span} at ` +
                `${usd(stats.previousClose)} and closed at ${usd(stats.close)}, a change of ` +
                `${stats.changePct.toFixed(2)}%.`,
        });
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
