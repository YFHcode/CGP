import { formatLongDate } from './history-periods';
import type { PeriodQuestion } from './period-faq';
import type { AnnualReturn, DrawdownSummary, MonthlySeasonality, VolatilityPoint } from './insights-metrics';
import type { HistoryPoint } from '@/types';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function usd(value: number): string {
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

interface InsightsQuestionsInput {
    metalName: string;
    series: HistoryPoint[];
    drawdowns: DrawdownSummary;
    volatility: VolatilityPoint[];
    returns: AnnualReturn[];
    seasonality: MonthlySeasonality[];
}

/** Long-tail Q&A for the insights pages, every answer computed from the same figures on the page. */
export function insightsQuestions({
    metalName,
    series,
    drawdowns,
    volatility,
    returns,
    seasonality,
}: InsightsQuestionsInput): PeriodQuestion[] {
    const lower = metalName.toLowerCase();
    const questions: PeriodQuestion[] = [];

    if (series.length === 0) return questions;

    let allTimeHigh = series[0];
    let allTimeLow = series[0];
    for (const point of series) {
        if (point.close > allTimeHigh.close) allTimeHigh = point;
        if (point.close < allTimeLow.close) allTimeLow = point;
    }

    questions.push({
        question: `What is ${lower}'s all-time high in our records?`,
        answer:
            `${metalName}'s highest close on record is ${usd(allTimeHigh.close)} per troy ounce, ` +
            `reached on ${formatLongDate(allTimeHigh.date)}.`,
    });

    questions.push({
        question: `What is ${lower}'s all-time low in our records?`,
        answer:
            `${metalName}'s lowest close on record is ${usd(allTimeLow.close)} per troy ounce, ` +
            `set on ${formatLongDate(allTimeLow.date)}.`,
    });

    if (drawdowns.currentDrawdownPct < 0) {
        questions.push({
            question: `How far below its all-time high is ${lower} right now?`,
            answer:
                `${metalName} is currently ${Math.abs(drawdowns.currentDrawdownPct).toFixed(1)}% below its ` +
                `all-time high, last set ${drawdowns.daysSinceAllTimeHigh} day${drawdowns.daysSinceAllTimeHigh === 1 ? '' : 's'} ago.`,
        });
    } else {
        questions.push({
            question: `Is ${lower} at an all-time high right now?`,
            answer: `Yes — ${metalName}'s latest close is its highest on record.`,
        });
    }

    if (drawdowns.maxDrawdown) {
        const { peakDate, troughDate, pct, recoveryDate } = drawdowns.maxDrawdown;
        questions.push({
            question: `What was ${lower}'s biggest decline on record?`,
            answer:
                `${metalName}'s largest peak-to-trough decline on record was ${pct.toFixed(1)}%, from ` +
                `${formatLongDate(peakDate)} to ${formatLongDate(troughDate)}` +
                (recoveryDate
                    ? `. It recovered back to that earlier high by ${formatLongDate(recoveryDate)}.`
                    : ', and it has not yet recovered back to that earlier high.'),
        });
    }

    if (volatility.length > 0) {
        const latestVolatility = volatility[volatility.length - 1];
        questions.push({
            question: `How volatile is ${lower} right now?`,
            answer:
                `Over the most recent 30 trading days, ${lower}'s daily closes have varied with a ` +
                `standard deviation of ${latestVolatility.volatilityPct.toFixed(2)}% per session.`,
        });
    }

    const completeReturns = returns.filter((r) => r.isComplete);
    if (completeReturns.length > 0) {
        const best = completeReturns.reduce((a, b) => (b.changePct > a.changePct ? b : a));
        const worst = completeReturns.reduce((a, b) => (b.changePct < a.changePct ? b : a));
        questions.push({
            question: `What was ${lower}'s best year on record?`,
            answer: `${metalName}'s strongest full calendar year on record was ${best.year}, up ${best.changePct.toFixed(1)}%.`,
        });
        if (worst.year !== best.year) {
            questions.push({
                question: `What was ${lower}'s worst year on record?`,
                answer: `${metalName}'s weakest full calendar year on record was ${worst.year}, ${worst.changePct >= 0 ? 'up' : 'down'} ${Math.abs(worst.changePct).toFixed(1)}%.`,
            });
        }
    }

    const withSamples = seasonality.filter((m) => m.sampleCount > 0);
    if (withSamples.length >= 6) {
        const bestMonth = withSamples.reduce((a, b) => (b.avgChangePct > a.avgChangePct ? b : a));
        const worstMonth = withSamples.reduce((a, b) => (b.avgChangePct < a.avgChangePct ? b : a));
        questions.push({
            question: `Is ${lower} seasonal? What month does it perform best?`,
            answer:
                `Across the years we hold, ${lower} has averaged its strongest performance in ` +
                `${MONTH_NAMES[bestMonth.month - 1]} (${bestMonth.avgChangePct >= 0 ? '+' : ''}${bestMonth.avgChangePct.toFixed(1)}% on average across ${bestMonth.sampleCount} year${bestMonth.sampleCount === 1 ? '' : 's'}) ` +
                `and its weakest in ${MONTH_NAMES[worstMonth.month - 1]} ` +
                `(${worstMonth.avgChangePct >= 0 ? '+' : ''}${worstMonth.avgChangePct.toFixed(1)}% on average). ` +
                `That is too short a history to call a reliable seasonal pattern — treat it as a starting observation, not a rule.`,
        });
    }

    return questions;
}
