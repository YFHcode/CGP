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

function periodQuestions(metal, stats) {
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
        return questions;
    }

    const span = period.kind === 'year' ? 'year' : 'month';
    const days = stats.points.length;
    const plural = days === 1 ? 'day' : 'days';

    questions.push({
        question: `How did ${lower} perform in ${label}?`,
        answer: `${name} finished ${label} at ${usd(stats.close)} per troy ounce, having ${direction(stats.change)} ${stats.change !== 0 ? `${usd(Math.abs(stats.change))} (${Math.abs(stats.changePct).toFixed(2)}%) ` : ''}over the ${span}. It traded between ${usd(stats.low)} and ${usd(stats.high)} across ${days} trading ${plural}.`,
    });
    questions.push({
        question: `What was the average ${lower} price in ${label}?`,
        answer: `The average ${lower} closing price in ${label} was ${usd(stats.average)} per troy ounce, calculated across all ${days} trading ${plural} in the ${span}.`,
    });
    questions.push({
        question: `What was the highest ${lower} price in ${label}?`,
        answer: `${name} reached its highest close of ${label} at ${usd(stats.high)} per troy ounce on ${longDate(stats.highDate)}.`,
    });
    questions.push({
        question: `What was the lowest ${lower} price in ${label}?`,
        answer: `The lowest ${lower} close in ${label} was ${usd(stats.low)} per troy ounce on ${longDate(stats.lowDate)}.`,
    });
    if (stats.previousClose !== null) {
        questions.push({
            question: `Did ${lower} go up or down in ${label}?`,
            answer: `${name} ${direction(stats.change)} during ${label}. It entered the ${span} at ${usd(stats.previousClose)} and closed at ${usd(stats.close)}, a change of ${stats.changePct.toFixed(2)}%.`,
        });
    }
    return questions;
}

const monthStats = {
    period: { kind: 'month', label: 'March 2026', key: '2026-03', slug: 'march-2026' },
    points: [{ date: '2026-03-02' }, { date: '2026-03-03' }, { date: '2026-03-04' }],
    close: 4100, high: 4200, low: 3900, average: 4050,
    highDate: '2026-03-10', lowDate: '2026-03-20',
    change: 100, changePct: 2.5, previousClose: 4000,
};

const dayStats = {
    period: { kind: 'day', label: '13 February 2025', key: '2025-02-13', slug: '13-february-2025' },
    points: [{ date: '2025-02-13' }],
    close: 2896.5, high: 2896.5, low: 2896.5, average: 2896.5,
    highDate: '2025-02-13', lowDate: '2025-02-13',
    change: -30, changePct: -1.025, previousClose: 2926.5,
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
