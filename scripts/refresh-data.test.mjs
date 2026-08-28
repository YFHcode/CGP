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
    sparseYears,
    windowsForYears,
} from './refresh-data.mjs';

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
    const existing = Array.from({ length: 5 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        close: 100 + i,
    }));
    const merged = mergeSeries(existing, [{ date: '2024-01-06', close: 999 }]);
    assert.equal(merged.length, 6, 'existing points must not be truncated');
    assert.deepEqual(merged.at(-1), { date: '2024-01-06', close: 999 });
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
    const existing = Array.from({ length: 4000 }, (_, i) => ({
        date: new Date(Date.UTC(2015, 0, 1 + i)).toISOString().slice(0, 10),
        close: 1000 + i,
    }));

    const merged = mergeSeries(existing, [{ date: '2030-01-01', close: 9999 }]);

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
