import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseStooqCsv,
    mergeSeries,
    isValidQuote,
    quoteToHistoryPoint,
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
