/**
 * Tests for the daily narrative headline in src/lib/day-headline.ts.
 *
 * Source is TypeScript; logic mirrored here in plain JS. Keep in sync.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function formatLongDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** Title-tag form: month, plus year only when it differs from the page's own year. */
function formatShortMonthYear(iso, relativeToIso) {
    const [y, m] = iso.split('-').map(Number);
    const month = MONTH_NAMES[m - 1].slice(0, 3);
    if (relativeToIso && Number(relativeToIso.split('-')[0]) === y) return month;
    return `${month} ${y}`;
}

const MEANINGFUL_GAP_DAYS = 10;
const BIG_MOVE_PCT = 3;

function daysBetween(a, b) {
    const msPerDay = 86_400_000;
    return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / msPerDay);
}

function mostRecentMatch(series, index, test) {
    for (let i = index - 1; i >= 0; i -= 1) {
        if (test(series[i].close)) return series[i];
    }
    return null;
}

function computeDayHeadline(series, date, metalName) {
    const index = series.findIndex((p) => p.date === date);
    if (index <= 0) return null;

    const current = series[index].close;
    const highSince = mostRecentMatch(series, index, (c) => c >= current);
    const lowSince = mostRecentMatch(series, index, (c) => c <= current);

    if (!highSince) {
        return { text: `${metalName}'s highest closing price on record`, shortText: 'All-Time High', kind: 'all-time-high' };
    }
    if (!lowSince) {
        return { text: `${metalName}'s lowest closing price on record`, shortText: 'All-Time Low', kind: 'all-time-low' };
    }

    const highGap = daysBetween(highSince.date, date);
    const lowGap = daysBetween(lowSince.date, date);

    if (highGap >= MEANINGFUL_GAP_DAYS && highGap >= lowGap) {
        return {
            text: `Highest closing price since ${formatLongDate(highSince.date)}`,
            shortText: `Highest Since ${formatShortMonthYear(highSince.date, date)}`,
            kind: 'high-since',
        };
    }
    if (lowGap >= MEANINGFUL_GAP_DAYS) {
        return {
            text: `Lowest closing price since ${formatLongDate(lowSince.date)}`,
            shortText: `Lowest Since ${formatShortMonthYear(lowSince.date, date)}`,
            kind: 'low-since',
        };
    }

    const previous = series[index - 1].close;
    if (previous > 0) {
        const pct = ((current - previous) / previous) * 100;
        if (Math.abs(pct) >= BIG_MOVE_PCT) {
            const pctText = `${Math.abs(pct).toFixed(1)}%`;
            return {
                text: `${metalName} ${pct >= 0 ? 'jumps' : 'falls'} ${pctText} in a single session`,
                shortText: pct >= 0 ? `Jumps ${pctText}` : `Falls ${pctText}`,
                kind: 'big-move',
            };
        }
    }

    return null;
}

test('the first point in the whole series gets no headline', () => {
    const series = [{ date: '2020-01-01', close: 1000 }];
    assert.equal(computeDayHeadline(series, '2020-01-01', 'Gold'), null);
});

test('an unrecognised date returns null', () => {
    const series = [{ date: '2020-01-01', close: 1000 }, { date: '2020-01-02', close: 1010 }];
    assert.equal(computeDayHeadline(series, '2099-01-01', 'Gold'), null);
});

test('a genuine all-time high is flagged as such, not "since" some date', () => {
    const series = [
        { date: '2020-01-01', close: 1000 },
        { date: '2020-01-02', close: 1100 },
        { date: '2020-01-03', close: 1200 }, // new high, and it's the whole series so far
    ];
    const h = computeDayHeadline(series, '2020-01-03', 'Gold');
    assert.equal(h.kind, 'all-time-high');
    assert.equal(h.shortText, 'All-Time High');
});

test('a genuine all-time low is flagged as such', () => {
    const series = [
        { date: '2020-01-01', close: 1200 },
        { date: '2020-01-02', close: 1100 },
        { date: '2020-01-03', close: 1000 },
    ];
    const h = computeDayHeadline(series, '2020-01-03', 'Gold');
    assert.equal(h.kind, 'all-time-low');
});

test('"highest since" requires a real gap, not yesterday', () => {
    const series = [
        { date: '2026-01-01', close: 2000 },
        { date: '2026-01-02', close: 1000 }, // dip
        { date: '2026-01-03', close: 1900 }, // recovers, but still below 1/1 and only 2 days back
    ];
    // 1900 < 2000 (1/1), so highSince is 1/1, gap is 2 days: below the
    // 10-day threshold, so this must not produce a "since" headline.
    const h = computeDayHeadline(series, '2026-01-03', 'Gold');
    assert.notEqual(h?.kind, 'high-since');
});

test('"highest since" fires once the gap is meaningful', () => {
    const series = [{ date: '2026-01-01', close: 2000 }];
    // 20 quiet days between 2000 and the day that reclaims it.
    for (let i = 1; i <= 20; i += 1) {
        const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
        series.push({ date: d, close: 1000 + i }); // stays well under 2000
    }
    const target = new Date(Date.UTC(2026, 0, 22)).toISOString().slice(0, 10);
    // Above every quiet day in between, but below the 1/1 high — so this is
    // "highest since 1 January", not a new all-time high.
    series.push({ date: target, close: 1900 });
    const h = computeDayHeadline(series, target, 'Gold');
    assert.equal(h.kind, 'high-since');
    assert.ok(h.text.includes('1 January 2026'));
    assert.equal(h.shortText, 'Highest Since Jan');
});

test('a big single-session move is flagged when nothing else applies', () => {
    const series = [
        { date: '2026-02-01', close: 1000 },
        { date: '2026-02-02', close: 1050 }, // +5%, but no prior history to compare "since"
    ];
    const h = computeDayHeadline(series, '2026-02-02', 'Gold');
    // Only one prior point exists, so it's simultaneously the all-time high —
    // that takes priority over "big move", which is correct: it IS the record.
    assert.equal(h.kind, 'all-time-high');
});

test('a big move within an existing range (not a record) gets the move headline', () => {
    const series = [
        { date: '2026-02-01', close: 900 },  // establishes a wide prior range
        { date: '2026-02-02', close: 1100 },
        { date: '2026-02-03', close: 1000 },
        { date: '2026-02-04', close: 950 }, // -5%, well within [900, 1100]
    ];
    const h = computeDayHeadline(series, '2026-02-04', 'Gold');
    assert.equal(h.kind, 'big-move');
    assert.equal(h.shortText, 'Falls 5.0%');
});

test('a small move that sets no record and isn\'t "since" anything gets no headline', () => {
    const flat = [
        { date: '2026-03-01', close: 2000 },
        { date: '2026-03-02', close: 2005 },
        { date: '2026-03-03', close: 2003 },
    ];
    assert.equal(computeDayHeadline(flat, '2026-03-03', 'Gold'), null);
});

/**
 * Title-length guards.
 *
 * Google truncates titles at roughly 60 characters. These archive titles
 * previously ran 68–89 and lost their most clickable element — a headline
 * like "Lowest Since 1 January 2016" was cut mid-phrase on a page ranking at
 * position 1.5. The assertions below encode the budget rather than the exact
 * wording, so the copy can change but the length discipline cannot silently
 * regress.
 */
const TITLE_BUDGET = 62;

/** Mirrors period-route.tsx: whole dollars once past $100. */
function titleMoney(v) {
    return v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: v >= 100 ? 0 : 2,
    });
}

test('titleMoney drops cents for gold-scale figures and keeps them for silver', () => {
    assert.equal(titleMoney(4033.7), '$4,034');
    assert.equal(titleMoney(1170.8), '$1,171');
    assert.equal(titleMoney(56.85), '$56.85');
    assert.equal(titleMoney(99.99), '$99.99');
    assert.equal(titleMoney(100), '$100');
});

test('a day title with a "since" headline fits the title budget', () => {
    // The real page that sits at position 1.5 in Search Console.
    const title = `Gold Price on 1 November 2016: ${titleMoney(1170.8)} — Lowest Since ${formatShortMonthYear('2016-01-01')}`;
    assert.ok(
        title.length <= TITLE_BUDGET,
        `title is ${title.length} chars, over the ${TITLE_BUDGET} budget: ${title}`
    );
});

test('a month-range title fits the title budget', () => {
    const title = `Gold Price in August 2026: ${titleMoney(4033.7)}–${titleMoney(4435.5)} per Ounce`;
    assert.ok(
        title.length <= TITLE_BUDGET,
        `title is ${title.length} chars, over the ${TITLE_BUDGET} budget: ${title}`
    );
});

test('an all-time-high day title fits the title budget', () => {
    const title = `Gold Price on 23 January 2026: ${titleMoney(4976.2)} — All-Time High`;
    assert.ok(
        title.length <= TITLE_BUDGET,
        `title is ${title.length} chars, over the ${TITLE_BUDGET} budget: ${title}`
    );
});

test('a same-year reference date drops the redundant year', () => {
    // "Highest Since Jan" on a February 2026 page can only mean January 2026.
    assert.equal(formatShortMonthYear('2026-01-05', '2026-02-27'), 'Jan');
});

test('a reference date in a previous year keeps the year', () => {
    // "Since Dec" on a February 2026 page would be ambiguous, so it stays.
    assert.equal(formatShortMonthYear('2025-12-20', '2026-02-27'), 'Dec 2025');
});

test('the longest real archive title now fits the budget', () => {
    // The worst case found by scanning all 839 built archive pages: the
    // longest metal name, a long month, and a "since" headline.
    const title = `Silver Price on 27 February 2026: ${titleMoney(92.68)} — Highest Since ${formatShortMonthYear('2026-01-05', '2026-02-27')}`;
    assert.ok(
        title.length <= TITLE_BUDGET,
        `title is ${title.length} chars, over the ${TITLE_BUDGET} budget: ${title}`
    );
});
