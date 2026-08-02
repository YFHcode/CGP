/**
 * Tests for the notable-day classifier in src/lib/notable-days.ts.
 *
 * This decides which of ~1,000 day pages are indexable, so a bug here either
 * floods the sitemap with routine days or hides genuinely notable ones. The
 * source is TypeScript; logic mirrored here in plain JS. Keep in sync.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const TOP_MOVES = 20;
const BIG_MOVE_PCT = 3;

function addReason(map, date, reason) {
    if (!date) return;
    const existing = map.get(date);
    if (existing) {
        if (!existing.includes(reason)) existing.push(reason);
    } else {
        map.set(date, [reason]);
    }
}

function findNotableDays(points) {
    const reasons = new Map();
    if (points.length === 0) return reasons;

    let allHigh = points[0];
    let allLow = points[0];
    for (const p of points) {
        if (p.close > allHigh.close) allHigh = p;
        if (p.close < allLow.close) allLow = p;
    }
    addReason(reasons, allHigh.date, 'highest price on record');
    addReason(reasons, allLow.date, 'lowest price on record');

    for (const [length, unit] of [[4, 'year'], [7, 'month']]) {
        const buckets = new Map();
        for (const p of points) {
            const key = p.date.slice(0, length);
            const b = buckets.get(key);
            if (!b) { buckets.set(key, { high: p, low: p }); continue; }
            if (p.close > b.high.close) b.high = p;
            if (p.close < b.low.close) b.low = p;
        }
        for (const b of buckets.values()) {
            if (b.high.date === b.low.date) continue;
            addReason(reasons, b.high.date, `highest close of the ${unit}`);
            addReason(reasons, b.low.date, `lowest close of the ${unit}`);
        }
    }

    const moves = [];
    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1].close;
        if (prev <= 0) continue;
        const pct = ((points[i].close - prev) / prev) * 100;
        if (Number.isFinite(pct)) moves.push({ date: points[i].date, pct });
    }
    moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    for (const m of moves.slice(0, TOP_MOVES)) {
        addReason(reasons, m.date, 'one of the largest single-day moves on record');
    }
    for (const m of moves) {
        if (Math.abs(m.pct) >= BIG_MOVE_PCT) {
            addReason(reasons, m.date, `moved more than ${BIG_MOVE_PCT}% in a session`);
        }
    }

    return reasons;
}

const notableDaySet = (points) => new Set(findNotableDays(points).keys());

/** A calm year with one spike and one crash. */
function buildSeries() {
    const points = [];
    let price = 2000;
    for (let i = 0; i < 300; i += 1) {
        const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
        price += (i % 7) - 3; // small oscillation, no big moves
        points.push({ date, close: price });
    }
    points[150].close = 5000; // obvious all-time high
    points[250].close = 100;  // obvious all-time low
    return points;
}

test('the all-time high and low are always notable', () => {
    const points = buildSeries();
    const notable = notableDaySet(points);
    assert.ok(notable.has(points[150].date), 'spike day must be indexable');
    assert.ok(notable.has(points[250].date), 'crash day must be indexable');

    const reasons = findNotableDays(points);
    assert.ok(reasons.get(points[150].date).includes('highest price on record'));
    assert.ok(reasons.get(points[250].date).includes('lowest price on record'));
});

test('routine days are not notable', () => {
    const points = buildSeries();
    const notable = notableDaySet(points);
    // The vast majority of a calm series should be excluded.
    assert.ok(notable.size < points.length * 0.35,
        `expected a small selection, got ${notable.size} of ${points.length}`);
    assert.ok(!notable.has(points[5].date), 'an ordinary early session is not notable');
});

test('monthly and yearly extremes are picked up', () => {
    const points = [
        { date: '2025-01-05', close: 100 },
        { date: '2025-01-10', close: 150 }, // Jan high
        { date: '2025-01-20', close: 90 },  // Jan low + all-time low
        { date: '2025-02-05', close: 120 },
        { date: '2025-02-15', close: 200 }, // Feb high + all-time high
        { date: '2025-02-25', close: 110 }, // Feb low
    ];
    const reasons = findNotableDays(points);
    assert.ok(reasons.get('2025-01-10').some((r) => r.includes('month')));
    assert.ok(reasons.get('2025-02-15').includes('highest price on record'));
    assert.ok(reasons.get('2025-02-25').some((r) => r.includes('month')));
});

test('a big single-session move is notable even if not an extreme', () => {
    const points = [
        { date: '2025-03-01', close: 1000 },
        { date: '2025-03-02', close: 1005 },
        { date: '2025-03-03', close: 1100 }, // +9.45%
        { date: '2025-03-04', close: 1102 },
        { date: '2025-03-05', close: 1103 },
    ];
    const reasons = findNotableDays(points);
    assert.ok(
        reasons.get('2025-03-03').some((r) => r.includes('3%')),
        'a 9% session must be flagged'
    );
});

test('a bucket with a single point yields no extreme', () => {
    // One reading in a month is not a "monthly high".
    const points = [{ date: '2025-06-15', close: 500 }];
    const reasons = findNotableDays(points);
    const list = reasons.get('2025-06-15') ?? [];
    assert.ok(!list.some((r) => r.includes('close of the month')));
});

test('reasons are deduplicated', () => {
    const points = buildSeries();
    for (const list of findNotableDays(points).values()) {
        assert.equal(new Set(list).size, list.length, 'no repeated reason strings');
    }
});

test('handles empty and single-point series without throwing', () => {
    assert.equal(findNotableDays([]).size, 0);
    assert.equal(notableDaySet([{ date: '2025-01-01', close: 1 }]).size, 1);
});

test('guards against a zero or negative previous close', () => {
    const points = [
        { date: '2025-01-01', close: 0 },
        { date: '2025-01-02', close: 100 },
    ];
    assert.doesNotThrow(() => findNotableDays(points));
});
