/**
 * Tests for the long-tail Q&A generator in src/lib/period-faq.ts.
 *
 * These strings are published across hundreds of pages, so a wrong word is a
 * site-wide factual error. The source is TypeScript; the logic is mirrored here
 * in plain JS. Keep the two in sync.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const usd = (v) =>
    v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
// Matches formatLongDate() in src/lib/history-periods.ts — day-first, so it
// never disagrees with the period label shown in the heading.
const longDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

const direction = (c) => (c > 0 ? 'rose' : c < 0 ? 'fell' : 'was unchanged');
const directionPerfect = (c) => (c > 0 ? 'risen' : c < 0 ? 'fallen' : 'been unchanged');

function periodQuestions(metal, stats, insights) {
    const name = metal === 'XAU' ? 'Gold' : 'Silver';
    const lower = name.toLowerCase();
    const { period } = stats;
    const label = period.label;
    const questions = [];

    if (period.kind === 'day') {
        questions.push({
            question: `What was the price of ${lower} on ${label}?`,
            answer:
                `${name} closed at ${usd(stats.close)} per troy ounce on ${label}. ` +
                (stats.previousClose !== null
                    ? `That is ${usd(Math.abs(stats.change))} ${stats.change >= 0 ? 'higher' : 'lower'} than the previous close of ${usd(stats.previousClose)}, a move of ${stats.changePct.toFixed(2)}%.`
                    : 'This is the earliest close in our records for this metal.'),
        });
        if (stats.previousClose !== null) {
            questions.push({
                question: `Did the ${lower} price go up or down on ${label}?`,
                answer: `The ${lower} price ${direction(stats.change)} on ${label}, ${stats.change >= 0 ? 'gaining' : 'losing'} ${usd(Math.abs(stats.change))} (${Math.abs(stats.changePct).toFixed(2)}%) against the previous session's close of ${usd(stats.previousClose)}.`,
            });
        }
        questions.push({
            question: `How much was one gram of ${lower} on ${label}?`,
            answer: `At ${usd(stats.close)} per troy ounce, one gram of pure ${lower} was worth about ${usd(stats.close / 31.1034768)} on ${label}. A troy ounce is 31.1034768 grams.`,
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
            if (insights.weekAgoClose !== null && insights.weekAgoChangePct !== null) {
                questions.push({
                    question: `How does the ${lower} price on ${label} compare with a week earlier?`,
                    answer:
                        `A week before ${label}, ${lower} was around ${usd(insights.weekAgoClose)} ` +
                        `per troy ounce, so the close of ${usd(stats.close)} is a ` +
                        `${insights.weekAgoChangePct >= 0 ? 'gain' : 'loss'} of ` +
                        `${Math.abs(insights.weekAgoChangePct).toFixed(1)}% over the week.`,
                });
            }
            if (insights.monthAgoClose !== null && insights.monthAgoChangePct !== null) {
                questions.push({
                    question: `How does the ${lower} price on ${label} compare with a month earlier?`,
                    answer:
                        `A month before ${label}, ${lower} was around ${usd(insights.monthAgoClose)} ` +
                        `per troy ounce, so the close of ${usd(stats.close)} is a ` +
                        `${insights.monthAgoChangePct >= 0 ? 'gain' : 'loss'} of ` +
                        `${Math.abs(insights.monthAgoChangePct).toFixed(1)}% over the month.`,
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

    const span = period.kind === 'year' ? 'year' : 'month';
    const complete = stats.isComplete;
    const soFar = complete ? '' : ' so far';
    const toDate = complete ? '' : ' to date';
    const asOf = complete ? '' : ` (through ${longDate(stats.points[stats.points.length - 1].date)})`;
    const days = stats.points.length;
    const plural = days === 1 ? 'day' : 'days';

    questions.push({
        question: `How did ${lower} perform in ${label}?`,
        answer:
            `${name} ${complete ? `finished ${label} at` : `is at`} ${usd(stats.close)} per troy ounce${soFar}, having ` +
            `${directionPerfect(stats.change)} ${stats.change !== 0 ? `${usd(Math.abs(stats.change))} (${Math.abs(stats.changePct).toFixed(2)}%) ` : ''}over the ${span}${toDate}. It has traded between ${usd(stats.low)} and ${usd(stats.high)} across ${days} trading ${plural}${soFar}${asOf}.`,
    });
    questions.push({
        question: `What was the average ${lower} price in ${label}?`,
        answer: `The average ${lower} closing price in ${label}${soFar} was ${usd(stats.average)} per troy ounce, calculated across all ${days} trading ${plural} in the ${span}${soFar}${asOf}.`,
    });
    questions.push({
        question: `What was the highest ${lower} price in ${label}?`,
        answer: `${name} reached its highest close ${complete ? `of ${label}` : `of ${label}${soFar}`} at ${usd(stats.high)} per troy ounce on ${longDate(stats.highDate)}.`,
    });
    questions.push({
        question: `What was the lowest ${lower} price in ${label}?`,
        answer: `The lowest ${lower} close in ${label}${soFar} was ${usd(stats.low)} per troy ounce on ${longDate(stats.lowDate)}.`,
    });
    if (stats.previousClose !== null) {
        questions.push({
            question: `Did ${lower} go up or down in ${label}?`,
            answer: `${name} ${complete ? direction(stats.change) : `has ${directionPerfect(stats.change)} so far`} during ${label}. It entered the ${span} at ${usd(stats.previousClose)} and ${complete ? 'closed' : 'is currently'} at ${usd(stats.close)}, a change of ${stats.changePct.toFixed(2)}%.`,
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
                        ? `. The strongest session ${complete ? 'was' : 'so far was'} ${longDate(insights.bestDay.date)} ` +
                          `(${insights.bestDay.pct >= 0 ? '+' : ''}${insights.bestDay.pct.toFixed(2)}%) ` +
                          `and the weakest ${longDate(insights.worstDay.date)} ` +
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

const monthStats = {
    period: { kind: 'month', label: 'March 2026', key: '2026-03', slug: 'march-2026' },
    points: [{ date: '2026-03-02' }, { date: '2026-03-03' }, { date: '2026-03-04' }],
    close: 4100, high: 4200, low: 3900, average: 4050,
    highDate: '2026-03-10', lowDate: '2026-03-20',
    change: 100, changePct: 2.5, previousClose: 4000,
    isComplete: true,
};

const dayStats = {
    period: { kind: 'day', label: '13 February 2025', key: '2025-02-13', slug: '13-february-2025' },
    points: [{ date: '2025-02-13' }],
    close: 2896.5, high: 2896.5, low: 2896.5, average: 2896.5,
    highDate: '2025-02-13', lowDate: '2025-02-13',
    change: -30, changePct: -1.025, previousClose: 2926.5,
    isComplete: true,
};

test('month questions target the long-tail phrasings people actually search', () => {
    const qs = periodQuestions('XAU', monthStats).map((q) => q.question);
    assert.ok(qs.includes('How did gold perform in March 2026?'));
    assert.ok(qs.includes('What was the average gold price in March 2026?'));
    assert.ok(qs.includes('What was the highest gold price in March 2026?'));
    assert.ok(qs.includes('What was the lowest gold price in March 2026?'));
    assert.ok(qs.includes('Did gold go up or down in March 2026?'));
});

test('day questions differ in shape from month questions', () => {
    const qs = periodQuestions('XAU', dayStats).map((q) => q.question);
    assert.ok(qs.includes('What was the price of gold on 13 February 2025?'));
    assert.ok(qs.includes('How much was one gram of gold on 13 February 2025?'));
    // A single day has no meaningful average or range, so those must not appear.
    assert.ok(!qs.some((q) => q.includes('average')));
});

test('answers state the real figures', () => {
    const answers = Object.fromEntries(
        periodQuestions('XAU', monthStats).map((q) => [q.question, q.answer])
    );
    assert.match(answers['What was the average gold price in March 2026?'], /\$4,050\.00/);
    assert.match(answers['What was the highest gold price in March 2026?'], /\$4,200\.00/);
    assert.match(answers['What was the highest gold price in March 2026?'], /10 March 2026/);
    assert.match(answers['What was the lowest gold price in March 2026?'], /\$3,900\.00/);
});

test('a falling period is described as falling, not rising', () => {
    const answers = periodQuestions('XAU', dayStats).map((q) => q.answer).join(' ');
    assert.match(answers, /fell/);
    assert.ok(!/\brose\b/.test(answers), 'a down day must never read as a gain');
    assert.match(answers, /lower than the previous close/);
});

test('gram conversion uses the exact troy ounce', () => {
    const answer = periodQuestions('XAU', dayStats).find((q) =>
        q.question.includes('one gram')
    ).answer;
    // 2896.50 / 31.1034768 = 93.1246..., which rounds to 93.12
    assert.match(answer, /\$93\.12/);
    assert.match(answer, /31\.1034768 grams/);
});

test('silver questions say silver, not gold', () => {
    const qs = periodQuestions('XAG', monthStats).map((q) => q.question).join(' ');
    assert.match(qs, /silver/);
    assert.ok(!/gold/.test(qs));
});

test('the first record omits comparisons it cannot make', () => {
    const first = { ...dayStats, previousClose: null, change: 0, changePct: 0 };
    const qs = periodQuestions('XAU', first);
    assert.ok(!qs.some((q) => q.question.includes('up or down')), 'no baseline to compare against');
    assert.match(qs[0].answer, /earliest close in our records/);
});

test('singular grammar when a period holds one trading day', () => {
    const single = { ...monthStats, points: [{ date: '2026-03-02' }] };
    const answer = periodQuestions('XAU', single)[0].answer;
    assert.match(answer, /1 trading day\./);
    assert.ok(!/1 trading days/.test(answer));
});

// --- isComplete: the regression a live Google snippet exposed --------------
// "Gold finished August 2026..." was published while August 2026 was still
// in progress. Every month/year answer must qualify itself instead.

test('an in-progress month is never described as finished', () => {
    const inProgress = { ...monthStats, isComplete: false, change: -100, changePct: -2.4 };
    const answers = periodQuestions('XAU', inProgress).map((q) => q.answer).join(' ');
    assert.ok(!/\bfinished\b/.test(answers), 'must not claim the period is over');
    assert.match(answers, /is at/);
    assert.match(answers, /so far/);
    // A negative change must use the perfect participle "fallen", not "fell".
    assert.match(answers, /having fallen/);
});

test('a completed month is still described as finished, using simple past', () => {
    const answers = periodQuestions('XAU', monthStats).map((q) => q.answer).join(' ');
    assert.match(answers, /finished March 2026 at/);
    assert.match(answers, /having risen/);
    assert.ok(!/\bso far\b/.test(answers), 'a settled period has nothing left to qualify');
});

test('"Did gold go up or down" uses present-perfect grammar only when incomplete', () => {
    const complete = periodQuestions('XAU', monthStats).find((q) => q.question.startsWith('Did gold'));
    assert.match(complete.answer, /Gold rose during/);

    const inProgress = periodQuestions('XAU', { ...monthStats, isComplete: false });
    const incomplete = inProgress.find((q) => q.question.startsWith('Did gold'));
    assert.match(incomplete.answer, /Gold has risen so far during/);
});

// --- week/month-ago insights-driven questions -------------------------------

const dayInsights = {
    upDays: 1, downDays: 0, flatDays: 0, bestDay: null, worstDay: null,
    rangePct: 0, volatilityPct: 0,
    perGram: 93.12, perKilo: 93124,
    perGramByKarat: [
        { karat: '24K', purity: 1, value: 93.12 },
        { karat: '18K', purity: 0.75, value: 69.84 },
        { karat: '14K', purity: 14 / 24, value: 54.32 },
    ],
    ratioClose: 65.4, ratioAverage: 65.4,
    yearAgoClose: 2500, yearAgoChangePct: 15.86,
    weekAgoClose: 2800, weekAgoChangePct: 3.45,
    monthAgoClose: null, monthAgoChangePct: null,
};

test('a week-ago comparison is asked and answered when we hold the data', () => {
    const qs = periodQuestions('XAU', dayStats, dayInsights);
    const q = qs.find((x) => x.question.includes('compare with a week earlier'));
    assert.ok(q, 'week-ago question must be present');
    assert.match(q.answer, /\$2,800\.00/);
    assert.match(q.answer, /gain/);
});

test('no month-ago question is asked when we do not hold that data', () => {
    const qs = periodQuestions('XAU', dayStats, dayInsights);
    assert.ok(!qs.some((q) => q.question.includes('compare with a month earlier')));
});

test('a loss is described as a loss, not a gain, in the week/month comparisons', () => {
    const losingInsights = { ...dayInsights, weekAgoClose: 3000, weekAgoChangePct: -3.45 };
    const q = periodQuestions('XAU', dayStats, losingInsights).find((x) =>
        x.question.includes('compare with a week earlier')
    );
    assert.match(q.answer, /loss/);
    assert.ok(!/gain/.test(q.answer));
});
