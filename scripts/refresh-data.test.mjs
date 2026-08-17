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
