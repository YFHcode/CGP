import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseStooqCsv,
    parseYahooChart,
    mergeSeries,
    isValidQuote,
    quoteToHistoryPoint,
    toArchiveEntry,
    mergeNewsArchive,
    parseApiKeys,
    collectExchangeRates,
    dropNonTradingDays,
    dropSpikes,
    sparseYears,
    isSourceExhausted,
    windowsForYears,
} from './refresh-data.mjs';

/**
 * `count` consecutive trading days from `startIso`, skipping weekends.
 *
 * Fixtures that walk raw calendar days now interact with the weekend prune in
 * mergeSeries, which makes them test the wrong thing.
 */
function weekdays(startIso, count) {
    const out = [];
    const cursor = new Date(`${startIso}T00:00:00Z`);
    while (out.length < count) {
        const day = cursor.getUTCDay();
        if (day !== 0 && day !== 6) out.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
}

const SAMPLE_CSV = `Date,Open,High,Low,Close,Volume
2024-01-02,2062.98,2088.44,2058.13,2058.98,0
2024-01-03,2059.11,2050.20,2030.00,2042.50,0
2024-01-04,2042.60,2049.90,2035.10,2044.30,0
`;

test('parseStooqCsv extracts date/close pairs in ascending order', () => {
    const points = parseStooqCsv(SAMPLE_CSV);
    assert.deepEqual(points, [
        { date: '2024-01-02', close: 2058.98 },
        { date: '2024-01-03', close: 2042.5 },
        { date: '2024-01-04', close: 2044.3 },
    ]);
});

test('parseStooqCsv drops malformed rows and non-numeric closes', () => {
    const csv = `Date,Open,High,Low,Close,Volume
2024-01-02,1,2,3,2058.98,0
not-a-date,1,2,3,100,0
2024-01-03,1,2,3,N/A,0
2024-01-04,1,2,3,-5,0
2024-01-05,1,2,3,2044.30,0
`;
    assert.deepEqual(parseStooqCsv(csv), [
        { date: '2024-01-02', close: 2058.98 },
        { date: '2024-01-05', close: 2044.3 },
    ]);
});

test('parseStooqCsv tolerates reordered columns', () => {
    const csv = `Date,Close,Open\n2024-01-02,1999.5,1990\n`;
    assert.deepEqual(parseStooqCsv(csv), [{ date: '2024-01-02', close: 1999.5 }]);
});

test('parseStooqCsv returns empty for junk, empty and error payloads', () => {
    assert.deepEqual(parseStooqCsv(''), []);
    assert.deepEqual(parseStooqCsv('   '), []);
    assert.deepEqual(parseStooqCsv('Exceeded the daily hits limit'), []);
    assert.deepEqual(parseStooqCsv(null), []);
    assert.deepEqual(parseStooqCsv(undefined), []);
});

test('parseStooqCsv keeps only the most recent maxPoints entries', () => {
    const rows = Array.from({ length: 10 }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return `2024-03-${day},1,2,3,${100 + i},0`;
    });
    const points = parseStooqCsv(`Date,Open,High,Low,Close,Volume\n${rows.join('\n')}\n`, 3);
    assert.equal(points.length, 3);
    assert.deepEqual(points.at(0), { date: '2024-03-08', close: 107 });
    assert.deepEqual(points.at(-1), { date: '2024-03-10', close: 109 });
});

// --- Yahoo Finance ---------------------------------------------------------

/** Mirrors the real chart endpoint's shape. */
const yahooPayload = (timestamps, closes) => ({
    chart: {
        result: [
            {
                meta: { symbol: 'XAUUSD=X', currency: 'USD' },
                timestamp: timestamps,
                indicators: { quote: [{ close: closes }] },
            },
        ],
        error: null,
    },
});

test('parseYahooChart pairs timestamps with closes', () => {
    // 2024-01-02, 2024-01-03, 2024-01-04 at 00:00 UTC
    const points = parseYahooChart(
        yahooPayload([1704153600, 1704240000, 1704326400], [2058.98, 2042.5, 2044.3])
    );
    assert.deepEqual(points, [
        { date: '2024-01-02', close: 2058.98 },
        { date: '2024-01-03', close: 2042.5 },
        { date: '2024-01-04', close: 2044.3 },
    ]);
});

test('parseYahooChart drops null closes for non-trading sessions', () => {
    // Yahoo emits null rather than omitting the row — charting it as 0 would
    // put a false crash in the series.
    const points = parseYahooChart(
        yahooPayload([1704153600, 1704240000, 1704326400], [2058.98, null, 2044.3])
    );
    assert.equal(points.length, 2);
    assert.deepEqual(points.map((p) => p.close), [2058.98, 2044.3]);
});

test('parseYahooChart drops non-finite and non-positive closes', () => {
    const points = parseYahooChart(
        yahooPayload([1704153600, 1704240000, 1704326400], [0, -12, 2044.3])
    );
    assert.deepEqual(points, [{ date: '2024-01-04', close: 2044.3 }]);
});

test('parseYahooChart collapses duplicate dates keeping the last', () => {
    // Two rows inside the same UTC day.
    const points = parseYahooChart(yahooPayload([1704153600, 1704196800], [2000, 2050]));
    assert.deepEqual(points, [{ date: '2024-01-02', close: 2050 }]);
});

test('parseYahooChart tolerates mismatched array lengths', () => {
    const points = parseYahooChart(yahooPayload([1704153600, 1704240000], [2058.98]));
    assert.equal(points.length, 1);
});

test('parseYahooChart returns empty for error and malformed payloads', () => {
    assert.deepEqual(parseYahooChart({ chart: { result: null, error: 'Not Found' } }), []);
    assert.deepEqual(parseYahooChart({ chart: {} }), []);
    assert.deepEqual(parseYahooChart({}), []);
    assert.deepEqual(parseYahooChart(null), []);
    // Missing indicators entirely.
    assert.deepEqual(parseYahooChart({ chart: { result: [{ timestamp: [1704153600] }] } }), []);
});

test('parseYahooChart honours maxPoints, keeping the newest', () => {
    const stamps = Array.from({ length: 10 }, (_, i) => 1704153600 + i * 86400);
    const closes = Array.from({ length: 10 }, (_, i) => 2000 + i);
    const points = parseYahooChart(yahooPayload(stamps, closes), 3);
    assert.equal(points.length, 3);
    assert.equal(points.at(-1).close, 2009);
});

test('mergeSeries unions by date and lets incoming win on conflict', () => {
    const existing = [
        { date: '2024-01-01', close: 100 },
        { date: '2024-01-02', close: 200 },
    ];
    const incoming = [
        { date: '2024-01-02', close: 222 },
        { date: '2024-01-03', close: 300 },
    ];
    assert.deepEqual(mergeSeries(existing, incoming), [
        { date: '2024-01-01', close: 100 },
        { date: '2024-01-02', close: 222 },
        { date: '2024-01-03', close: 300 },
    ]);
});

test('mergeSeries preserves accumulated history when incoming is a short window', () => {
    // Weekdays only. The fixture previously ran across consecutive calendar
    // days, which since the weekend prune would have had Saturday dropped —
    // testing the prune by accident instead of what this is actually about,
    // which is that a short incoming window must not truncate the archive.
    const existing = weekdays('2024-01-01', 5).map((date, i) => ({ date, close: 100 + i }));
    const extra = weekdays('2024-01-01', 6).at(-1);
    const merged = mergeSeries(existing, [{ date: extra, close: 999 }]);
    assert.equal(merged.length, 6, 'existing points must not be truncated');
    assert.deepEqual(merged.at(-1), { date: extra, close: 999 });
});

test('mergeSeries handles empty/undefined inputs and drops junk points', () => {
    assert.deepEqual(mergeSeries(undefined, undefined), []);
    assert.deepEqual(mergeSeries([], [{ date: '2024-01-01', close: 1 }]), [
        { date: '2024-01-01', close: 1 },
    ]);
    assert.deepEqual(mergeSeries([{ date: '2024-01-01', close: Number.NaN }], []), []);
    assert.deepEqual(mergeSeries([null, undefined], []), []);
});

test('isValidQuote rejects payloads without a usable price', () => {
    assert.equal(isValidQuote({ price: 2000 }), true);
    assert.equal(isValidQuote({ price: 0 }), false);
    assert.equal(isValidQuote({ price: -1 }), false);
    assert.equal(isValidQuote({ price: 'x' }), false);
    assert.equal(isValidQuote({ error: 'quota exceeded' }), false);
    assert.equal(isValidQuote(null), false);
    assert.equal(isValidQuote(undefined), false);
});

test('quoteToHistoryPoint converts a live quote into a dated point', () => {
    const point = quoteToHistoryPoint({ price: 2345.6 }, new Date('2026-08-02T10:00:00Z'));
    assert.deepEqual(point, { date: '2026-08-02', close: 2345.6 });
    assert.equal(quoteToHistoryPoint({ price: 0 }), null);
});

// --- News archive ----------------------------------------------------------

test('toArchiveEntry keeps only link metadata, never article content', () => {
    const entry = toArchiveEntry(
        {
            title: 'Gold hits record high',
            link: 'https://www.reuters.com/markets/gold-record',
            source: 'Reuters',
            date: '2 hours ago',
            snippet: 'Copyrighted article text that must not be stored.',
            thumbnail: 'https://example.com/copyrighted.jpg',
        },
        new Date('2026-08-02T12:00:00Z')
    );

    assert.deepEqual(entry, {
        title: 'Gold hits record high',
        link: 'https://www.reuters.com/markets/gold-record',
        source: 'Reuters',
        reportedDate: '2 hours ago',
        seenAt: '2026-08-02T12:00:00.000Z',
    });
    assert.equal(entry.snippet, undefined, 'snippet must not be archived');
    assert.equal(entry.thumbnail, undefined, 'thumbnail must not be archived');
});

test('toArchiveEntry falls back to the hostname when no source is given', () => {
    const entry = toArchiveEntry({ title: 'X', link: 'https://www.bloomberg.com/a/b' });
    assert.equal(entry.source, 'bloomberg.com');
});

test('toArchiveEntry rejects entries it cannot link to', () => {
    assert.equal(toArchiveEntry({ title: 'X' }), null, 'no link');
    assert.equal(toArchiveEntry({ link: 'https://a.com' }), null, 'no title');
    assert.equal(toArchiveEntry({ title: 'X', link: 'not a url' }), null);
    assert.equal(toArchiveEntry({ title: '  ', link: 'https://a.com' }), null);
    assert.equal(toArchiveEntry(null), null);
});

test('mergeNewsArchive dedupes by link across runs', () => {
    const existing = [
        { title: 'A', link: 'https://a.com/1', seenAt: '2026-08-01T00:00:00.000Z' },
    ];
    const incoming = [
        { title: 'A (reworded headline)', link: 'https://a.com/1', seenAt: '2026-08-02T00:00:00.000Z' },
        { title: 'B', link: 'https://b.com/2', seenAt: '2026-08-02T00:00:00.000Z' },
    ];

    const merged = mergeNewsArchive(existing, incoming);
    assert.equal(merged.length, 2, 'the repeated story is archived once');
    const kept = merged.find((e) => e.link === 'https://a.com/1');
    assert.equal(kept.title, 'A', 'first sighting is kept, closest to publication');
});

test('mergeNewsArchive sorts newest first and honours the cap', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
        title: `T${i}`,
        link: `https://x.com/${i}`,
        seenAt: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));

    const merged = mergeNewsArchive([], items, 3);
    assert.equal(merged.length, 3);
    assert.equal(merged[0].link, 'https://x.com/9', 'newest first');
});

test('mergeNewsArchive tolerates empty and malformed input', () => {
    assert.deepEqual(mergeNewsArchive(), []);
    assert.deepEqual(mergeNewsArchive([null, undefined], []), []);
    assert.deepEqual(mergeNewsArchive([], [{ title: 'no link' }]), []);
});

// --- History is append-only -------------------------------------------------

test('mergeSeries never drops old points by default', () => {
    // The archive publishes a page per day, so silently trimming the oldest
    // entry would 404 a page that had already been indexed.
    // Weekdays only, for the same reason as above: this asserts that nothing
    // is trimmed for age, not that weekends are kept.
    const existing = weekdays('2015-01-01', 4000).map((date, i) => ({ date, close: 1000 + i }));

    // Derived from the fixture rather than hardcoded: 4,000 weekdays from 2015
    // run past 2030, so a fixed date landed inside the existing range and added
    // nothing.
    const newer = weekdays(existing.at(-1).date, 2).at(-1);
    const merged = mergeSeries(existing, [{ date: newer, close: 9999 }]);

    assert.equal(merged.length, 4001, 'every historical point survives');
    assert.equal(merged[0].date, existing[0].date, 'oldest point is still first');
    assert.equal(merged.at(-1).close, 9999);
});

test('mergeSeries still honours an explicit finite cap', () => {
    const existing = [
        { date: '2024-01-01', close: 1 },
        { date: '2024-01-02', close: 2 },
        { date: '2024-01-03', close: 3 },
    ];
    assert.equal(mergeSeries(existing, [], 2).length, 2);
});

test('parseApiKeys falls back to the default list when the env var is unset', () => {
    assert.deepEqual(parseApiKeys(undefined, 'key-a,key-b'), ['key-a', 'key-b']);
});

test('parseApiKeys falls back when the env var is an empty string', () => {
    // GitHub Actions passes an unset secret as '', not undefined — `||` (not
    // `??`) is required so this still falls through to the default rather
    // than producing a single blank credential.
    assert.deepEqual(parseApiKeys('', 'key-a,key-b'), ['key-a', 'key-b']);
});

test('parseApiKeys uses the override when present', () => {
    assert.deepEqual(parseApiKeys('key-x,key-y,key-z', 'key-a'), ['key-x', 'key-y', 'key-z']);
});

test('parseApiKeys trims whitespace and drops empty entries from a ragged list', () => {
    assert.deepEqual(parseApiKeys(' key-x ,, key-y,', 'key-a'), ['key-x', 'key-y']);
});

test('parseApiKeys handles a single key with no commas', () => {
    assert.deepEqual(parseApiKeys('only-one-key', 'key-a,key-b'), ['only-one-key']);
});

// --- collectExchangeRates --------------------------------------------------

const quote = (currency, exchangeRate) => ({
    currency,
    currencySymbol: '$',
    exchangeRate,
    name: 'Gold',
    price: 4400 * exchangeRate,
    symbol: 'XAU',
});

test('collectExchangeRates builds a USD-based map and always anchors USD at 1', () => {
    const rates = collectExchangeRates([
        { requested: 'EUR', payload: quote('EUR', 0.92) },
        { requested: 'INR', payload: quote('INR', 87.4) },
        { requested: 'JPY', payload: quote('JPY', 155.2) },
    ]);
    assert.equal(rates.USD, 1);
    assert.equal(rates.EUR, 0.92);
    assert.equal(rates.INR, 87.4);
    assert.equal(rates.JPY, 155.2);
});

test('a quote answered in the wrong currency is rejected, not recorded as parity', () => {
    // The failure this exists for: the provider ignores the currency segment
    // and answers in USD. The payload is structurally valid, so only the
    // currency check catches it — and accepting it would price Indian gold at
    // the dollar figure.
    const rates = collectExchangeRates([
        { requested: 'INR', payload: quote('USD', 1) },
        { requested: 'EUR', payload: quote('EUR', 0.92) },
    ]);
    assert.equal(rates.INR, undefined, 'INR must not be recorded from a USD answer');
    assert.equal(rates.EUR, 0.92, 'the valid entry alongside it still lands');
});

test('the currency check is case-insensitive but not value-insensitive', () => {
    const rates = collectExchangeRates([{ requested: 'eur', payload: quote('EUR', 0.92) }]);
    assert.equal(rates.EUR, 0.92);
});

test('non-numeric, zero, negative and missing rates are dropped', () => {
    const rates = collectExchangeRates([
        { requested: 'EUR', payload: quote('EUR', 0) },
        { requested: 'GBP', payload: quote('GBP', -1) },
        { requested: 'CAD', payload: quote('CAD', Number.NaN) },
        { requested: 'AUD', payload: quote('AUD', 'nope') },
        { requested: 'CNY', payload: { currency: 'CNY' } },
        { requested: 'JPY', payload: null },
    ]);
    assert.deepEqual(rates, { USD: 1 }, 'nothing usable should survive');
});

test('collectExchangeRates never produces a rate that would invert a conversion', () => {
    // A USD-based rate is "how many units of the currency one dollar buys", so
    // every accepted value must be strictly positive and finite; a zero would
    // divide to Infinity downstream.
    const rates = collectExchangeRates([
        { requested: 'EUR', payload: quote('EUR', 0.92) },
        { requested: 'INR', payload: quote('INR', 87.4) },
    ]);
    for (const [code, rate] of Object.entries(rates)) {
        assert.ok(Number.isFinite(rate) && rate > 0, `${code} rate is unusable: ${rate}`);
    }
});

test('malformed input yields a USD-only map rather than throwing', () => {
    for (const bad of [null, undefined, 'nope', 42, {}]) {
        assert.deepEqual(collectExchangeRates(bad), { USD: 1 });
    }
    assert.deepEqual(collectExchangeRates([]), { USD: 1 });
});

// --- sparseYears / windowsForYears ----------------------------------------

const dailyYear = (year, n = 250) => {
    const pts = [];
    const d = new Date(Date.UTC(year, 0, 1));
    while (pts.length < n) {
        if (d.getUTCDay() % 6 !== 0) pts.push({ date: d.toISOString().slice(0, 10), close: 100 });
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return pts;
};
const monthlyYear = (year) =>
    Array.from({ length: 12 }, (_, m) => ({
        date: `${year}-${String(m + 1).padStart(2, '0')}-01`,
        close: 100,
    }));

test('sparseYears separates monthly years from daily ones by a wide margin', () => {
    const points = [...monthlyYear(2020), ...monthlyYear(2021), ...dailyYear(2022)];
    assert.deepEqual(sparseYears(points, { endYear: 2022 }), [2020, 2021]);
});

test('the threshold is not delicately placed between the two cadences', () => {
    // A trading year is ~250 sessions and a monthly sample is 12; the cutoff
    // sits far from both, so neither classification is a close call.
    const monthly = monthlyYear(2020).length;
    const daily = dailyYear(2020).length;
    assert.ok(monthly < 100 / 2, `monthly year (${monthly}) should be well under the threshold`);
    assert.ok(daily > 100 * 2, `daily year (${daily}) should be well over the threshold`);
});

test('sparseYears does not reach back before the series begins', () => {
    // Backfilling years a contract did not exist for would fetch empty windows
    // on every run, forever.
    const points = dailyYear(2020);
    assert.deepEqual(sparseYears(points, { startYear: 1995, endYear: 2020 }), []);
});

test('sparseYears reports years missing entirely from the series', () => {
    const points = [...dailyYear(2020), ...dailyYear(2023)];
    assert.deepEqual(sparseYears(points, { endYear: 2023 }), [2021, 2022]);
});

test('sparseYears treats an empty or unparseable series as needing the current year', () => {
    // Not an edge case to swallow: a series with nothing usable in it really
    // does lack data for the current year, and asking for one window is the
    // correct response. What matters is that it never throws and never asks
    // for decades it has no evidence for.
    for (const bad of [null, undefined, 'nope', 42, [], [{ date: 'not-a-date' }]]) {
        const years = sparseYears(bad, { endYear: 2020 });
        assert.deepEqual(years, [2020], `unexpected result for ${JSON.stringify(bad)}`);
    }
});

/** Daily from `fromMonth` onward, one point a month before it — the 2024 shape. */
const halfMonthlyYear = (year, fromMonth) => {
    const pts = [];
    for (let m = 1; m < fromMonth; m++) {
        pts.push({ date: `${year}-${String(m).padStart(2, '0')}-15`, close: 100 });
    }
    const d = new Date(Date.UTC(year, fromMonth - 1, 1));
    while (d.getUTCFullYear() === year) {
        if (d.getUTCDay() % 6 !== 0) pts.push({ date: d.toISOString().slice(0, 10), close: 100 });
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return pts;
};

test('a year that is monthly for half of it is sparse despite clearing the year total', () => {
    // The defect this guards. Our 2024 held 112 points — over minPerYear — but
    // they were six monthly stamps for January to July and daily closes only
    // from August. The year total said dense; seven months of the year were
    // one point each, and the backfill skipped them for months.
    const y2024 = halfMonthlyYear(2024, 8);
    assert.ok(y2024.length > 100, `fixture should clear minPerYear, got ${y2024.length}`);

    const points = [...dailyYear(2023), ...y2024, ...dailyYear(2025)];
    assert.deepEqual(sparseYears(points, { endYear: 2025 }), [2024]);
});

test('a single thin month is enough to flag its year', () => {
    // Platinum had years totalling 215 points with a 3-point November inside
    // them. A whole-year test cannot see that.
    const full = dailyYear(2005);
    const thinned = full.filter((p) => !p.date.startsWith('2005-11') || p.date < '2005-11-05');
    assert.ok(thinned.length > 200, 'the year should still clear the year total');

    const points = [...dailyYear(2004), ...thinned, ...dailyYear(2006)];
    assert.deepEqual(sparseYears(points, { endYear: 2006 }), [2005]);
});

test("the series' own first and last months are exempt from the month check", () => {
    // Both are partial by definition. Flagging the last one would make the
    // backfill re-fetch the current month on every run, forever.
    const full = dailyYear(2021);
    const partial = full.filter((p) => p.date >= '2021-01-28' && p.date <= '2021-12-03');
    assert.deepEqual(sparseYears(partial, { endYear: 2021 }), []);
});

test("the series' opening year is prorated rather than compared to a full year", () => {
    // Ours begins on 30 August 2000, so that year can only ever hold ~84
    // points. A flat threshold makes it sparse forever and re-fetches data
    // that does not exist — the opposite of what this function is for.
    const opening = dailyYear(2000).filter((p) => p.date >= '2000-08-30');
    assert.ok(opening.length < 100, `fixture should be under minPerYear, got ${opening.length}`);

    const points = [...opening, ...dailyYear(2001)];
    assert.deepEqual(sparseYears(points, { endYear: 2001 }), []);
});

test('proration cannot rescue an opening year that is genuinely monthly', () => {
    // The month check still applies, so a partial first year made of monthly
    // stamps is still caught.
    const points = [
        ...['2000-02-15', '2000-03-15', '2000-04-15', '2000-05-15', '2000-06-15', '2000-07-15']
            .map((date) => ({ date, close: 100 })),
        ...dailyYear(2001),
    ];
    assert.deepEqual(sparseYears(points, { endYear: 2001 }), [2000]);
});

test('windowsForYears merges consecutive years up to the window width', () => {
    assert.deepEqual(windowsForYears([2000, 2001, 2002, 2003], 2), [
        { start: 2000, end: 2001 },
        { start: 2002, end: 2003 },
    ]);
});

test('windowsForYears does not bridge a gap between non-consecutive years', () => {
    // 2005 and 2009 must not be merged into one window, or the request would
    // silently cover four years and defeat the point of windowing.
    assert.deepEqual(windowsForYears([2005, 2009], 2), [
        { start: 2005, end: 2005 },
        { start: 2009, end: 2009 },
    ]);
});

test('windowsForYears dedupes, sorts and ignores non-integers', () => {
    assert.deepEqual(windowsForYears([2002, 2001, 2001, null, 'x', 2002], 2), [
        { start: 2001, end: 2002 },
    ]);
    assert.deepEqual(windowsForYears([], 2), []);
    assert.deepEqual(windowsForYears(null, 2), []);
});

test('a full backfill of a 26-year monthly series costs a bounded number of requests', () => {
    const points = [];
    for (let y = 2000; y <= 2025; y++) points.push(...monthlyYear(y));
    const windows = windowsForYears(sparseYears(points, { endYear: 2025 }), 2);
    assert.equal(windows.length, 13, `expected 13 two-year windows, got ${windows.length}`);
});

test('once backfilled, a dense series asks for nothing', () => {
    // The property that keeps this from re-fetching the archive twice a day.
    const points = [];
    for (let y = 2020; y <= 2023; y++) points.push(...dailyYear(y));
    assert.deepEqual(windowsForYears(sparseYears(points, { endYear: 2023 }), 2), []);
});

// --- dropNonTradingDays ----------------------------------------------------

test('weekend-dated closes are removed, because an exchange cannot close then', () => {
    const points = [
        { date: '2026-08-27', close: 100 }, // Thursday
        { date: '2026-08-28', close: 101 }, // Friday
        { date: '2026-08-29', close: 999 }, // Saturday
        { date: '2026-08-30', close: 999 }, // Sunday
        { date: '2026-08-31', close: 102 }, // Monday
    ];
    assert.deepEqual(dropNonTradingDays(points).map((p) => p.date), [
        '2026-08-27',
        '2026-08-28',
        '2026-08-31',
    ]);
});

test('mergeSeries drops weekend artifacts rather than carrying them forward', () => {
    // The real defect: the legacy monthly series sampled the 1st of each month
    // regardless of whether it traded, and those points survived the daily
    // backfill because a Saturday has no genuine session to overwrite it. Each
    // then sat between two real closes at a different price, manufacturing a
    // spike and an equal reversal.
    const existing = [{ date: '2006-04-01', close: 651.8 }]; // a Saturday
    const incoming = [
        { date: '2006-03-31', close: 581.8 },
        { date: '2006-04-03', close: 589.4 },
    ];
    const merged = mergeSeries(existing, incoming);
    assert.deepEqual(merged.map((p) => p.date), ['2006-03-31', '2006-04-03']);

    // And the spurious move is gone with it.
    const move = Math.abs(Math.log(merged[1].close / merged[0].close));
    assert.ok(move < 0.05, `expected a small move after pruning, got ${(move * 100).toFixed(1)}%`);
});

test('genuine first-of-month trading days are kept', () => {
    // The rule must key on the weekday, not on the day-of-month: plenty of
    // real sessions fall on the 1st.
    const points = [
        { date: '2026-09-01', close: 100 }, // Tuesday
        { date: '2026-06-01', close: 101 }, // Monday
    ];
    assert.equal(dropNonTradingDays(points).length, 2);
});

test('dropNonTradingDays tolerates malformed input', () => {
    assert.deepEqual(dropNonTradingDays(null), []);
    assert.deepEqual(dropNonTradingDays(undefined), []);
    assert.deepEqual(dropNonTradingDays([null, { close: 1 }, { date: 42 }]), []);
});

// --- dropSpikes ------------------------------------------------------------

test('a single point that spikes and reverts is removed', () => {
    // The remaining artifact class after the weekend prune: a legacy monthly
    // sample landing on a market holiday, where the calendar day is a weekday
    // but no session traded, so nothing genuine overwrote it.
    const points = [
        { date: '2007-12-31', close: 834.9 },
        { date: '2008-01-01', close: 922.7 }, // New Year's Day — exchange shut
        { date: '2008-01-02', close: 854.4 },
    ];
    assert.deepEqual(dropSpikes(points).map((p) => p.date), ['2007-12-31', '2008-01-02']);
});

test('a genuine crash is preserved, because it does not revert', () => {
    // Gold really did fall about 9.8% on 15 April 2013. The next session moved
    // only +1.9%, so the price stayed at its new level — which is exactly what
    // separates a real move from a bad point, and why the filter needs the
    // revert condition rather than just a size threshold.
    const points = [
        { date: '2013-04-12', close: 1501.0 },
        { date: '2013-04-15', close: 1360.6 },
        { date: '2013-04-16', close: 1387.4 },
    ];
    assert.deepEqual(dropSpikes(points).length, 3, 'a real crash must not be deleted');
});

test('all three conditions are required, not any one of them', () => {
    // Large in-move but small out-move: kept.
    assert.equal(
        dropSpikes([
            { date: '2024-01-01', close: 100 },
            { date: '2024-01-02', close: 112 },
            { date: '2024-01-03', close: 113 },
        ]).length,
        3
    );
    // Large moves in both directions but the same sign — a real run, kept.
    assert.equal(
        dropSpikes([
            { date: '2024-01-01', close: 100 },
            { date: '2024-01-02', close: 110 },
            { date: '2024-01-03', close: 121 },
        ]).length,
        3
    );
    // Spikes and reverts, but the neighbours disagree by more than the
    // threshold, so the move was partly real: kept.
    assert.equal(
        dropSpikes([
            { date: '2024-01-01', close: 100 },
            { date: '2024-01-02', close: 112 },
            { date: '2024-01-03', close: 106 },
        ]).length,
        3
    );
});

test('dropSpikes leaves short and malformed series alone', () => {
    assert.deepEqual(dropSpikes([]), []);
    assert.deepEqual(dropSpikes(null), []);
    assert.equal(dropSpikes([{ date: '2024-01-01', close: 1 }]).length, 1);
    assert.equal(
        dropSpikes([
            { date: '2024-01-01', close: 100 },
            { date: '2024-01-02', close: 0 },
            { date: '2024-01-03', close: 100 },
        ]).length,
        3,
        'a non-positive close cannot be judged and is left for the caller to drop'
    );
});

// --- isSourceExhausted -------------------------------------------------------

const day = (date, close = 100) => ({ date, close });

test('a window returning only sessions we already hold is exhausted', () => {
    // Yahoo carries about 130 sessions a year for PL=F before 2010; those
    // contracts were thinly traded and the record is genuinely incomplete. The
    // year can never satisfy a density test, so without this it would be
    // re-requested twice a day for as long as the site exists.
    const existing = [day('2006-01-03'), day('2006-01-04'), day('2006-01-05')];
    assert.equal(isSourceExhausted(existing, [day('2006-01-03'), day('2006-01-04')]), true);
});

test('one genuinely new session keeps a window eligible', () => {
    const existing = [day('2006-01-03'), day('2006-01-04')];
    assert.equal(isSourceExhausted(existing, [day('2006-01-05')]), false);
});

test('a session the cleaning always discards does not keep a window alive forever', () => {
    // The failure this guards, and the reason exhaustion is judged by running
    // the real merge rather than by comparing raw dates. mergeSeries drops
    // weekend-dated closes, so such a point is never in the stored series. A
    // date comparison would call it new on every single run and the window
    // would never converge — the mechanism would add state and cost while
    // achieving nothing.
    const existing = [day('2006-01-05'), day('2006-01-06')];
    const saturday = '2006-01-07';
    assert.equal(new Date(saturday + 'T00:00:00Z').getUTCDay(), 6, 'fixture must be a Saturday');
    assert.equal(isSourceExhausted(existing, [day('2006-01-06'), day(saturday)]), true);
});

test('an empty response is a transient miss, not an exhausted source', () => {
    // The distinction that matters. One failed fetch must never permanently
    // abandon a decade of backfill.
    const existing = [day('2006-01-03')];
    assert.equal(isSourceExhausted(existing, []), false);
    assert.equal(isSourceExhausted(existing, null), false);
    assert.equal(isSourceExhausted(existing, undefined), false);
});

test('an empty stored series is never treated as exhausted', () => {
    assert.equal(isSourceExhausted([], [day('2006-01-03')]), false);
    assert.equal(isSourceExhausted(undefined, [day('2006-01-03')]), false);
});

test('a malformed point cannot exhaust a window on its own', () => {
    // Erring toward one more fetch is cheap; erring toward abandonment is not.
    const existing = [day('2006-01-03')];
    assert.equal(isSourceExhausted(existing, [{ date: '2006-01-04', close: 'nope' }]), true);
    assert.equal(isSourceExhausted(existing, [day('2006-01-04')]), false);
});
