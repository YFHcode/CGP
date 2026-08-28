import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors src/lib/market-hours.ts.
 *
 * The instants below are asserted against the published COMEX metals session
 * (Sunday 18:00 ET to Friday 17:00 ET, with a 17:00-18:00 ET daily break), not
 * against whatever the implementation happens to return. Both a winter (EST,
 * UTC-5) and a summer (EDT, UTC-4) date are used, because the whole reason
 * this goes through Intl rather than a fixed offset is DST.
 */

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const ET_FORMAT = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

function easternParts(date) {
    const parts = ET_FORMAT.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return {
        weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
        hour: Number(get('hour')),
        minute: Number(get('minute')),
    };
}

function isMetalsMarketOpen(date = new Date()) {
    const { weekday, hour } = easternParts(date);
    if (weekday === 6) return false;
    if (weekday === 0) return hour >= 18;
    if (weekday === 5) return hour < 17;
    return hour !== 17;
}

test('Eastern parts track DST rather than a fixed UTC offset', () => {
    // 2026-01-14 is a Wednesday in EST (UTC-5): 18:00Z is 13:00 ET.
    assert.deepEqual(easternParts(new Date('2026-01-14T18:00:00Z')), {
        weekday: 3,
        hour: 13,
        minute: 0,
    });
    // 2026-07-15 is a Wednesday in EDT (UTC-4): 18:00Z is 14:00 ET.
    assert.deepEqual(easternParts(new Date('2026-07-15T18:00:00Z')), {
        weekday: 3,
        hour: 14,
        minute: 0,
    });
});

test('Saturday is closed all day', () => {
    for (const iso of [
        '2026-01-17T05:00:00Z',
        '2026-01-17T18:00:00Z',
        '2026-01-17T23:30:00Z',
        '2026-07-18T16:00:00Z',
    ]) {
        assert.equal(isMetalsMarketOpen(new Date(iso)), false, `expected closed at ${iso}`);
    }
});

test('Sunday reopens at 18:00 ET, not before', () => {
    // EST: 18:00 ET = 23:00Z same day; 17:59 ET = 22:59Z.
    assert.equal(isMetalsMarketOpen(new Date('2026-01-18T22:59:00Z')), false);
    assert.equal(isMetalsMarketOpen(new Date('2026-01-18T23:00:00Z')), true);
    // EDT: 18:00 ET = 22:00Z; 17:59 ET = 21:59Z.
    assert.equal(isMetalsMarketOpen(new Date('2026-07-19T21:59:00Z')), false);
    assert.equal(isMetalsMarketOpen(new Date('2026-07-19T22:00:00Z')), true);
});

test('Friday closes at 17:00 ET and stays shut', () => {
    // EST: 16:59 ET = 21:59Z, 17:00 ET = 22:00Z.
    assert.equal(isMetalsMarketOpen(new Date('2026-01-16T21:59:00Z')), true);
    assert.equal(isMetalsMarketOpen(new Date('2026-01-16T22:00:00Z')), false);
    // EDT: 16:59 ET = 20:59Z, 17:00 ET = 21:00Z.
    assert.equal(isMetalsMarketOpen(new Date('2026-07-17T20:59:00Z')), true);
    assert.equal(isMetalsMarketOpen(new Date('2026-07-17T21:00:00Z')), false);
});

test('the weekday 17:00-18:00 ET break is closed, and trading resumes after', () => {
    // Wednesday in EST: 17:00 ET = 22:00Z, 18:00 ET = 23:00Z.
    assert.equal(isMetalsMarketOpen(new Date('2026-01-14T21:59:00Z')), true, '16:59 ET open');
    assert.equal(isMetalsMarketOpen(new Date('2026-01-14T22:00:00Z')), false, '17:00 ET break');
    assert.equal(isMetalsMarketOpen(new Date('2026-01-14T22:59:00Z')), false, '17:59 ET break');
    assert.equal(isMetalsMarketOpen(new Date('2026-01-14T23:00:00Z')), true, '18:00 ET open');
});

test('the small hours of a weekday are trading', () => {
    // Tuesday 03:00 ET (EST) = 08:00Z — Asian session, genuinely open.
    assert.equal(isMetalsMarketOpen(new Date('2026-01-13T08:00:00Z')), true);
});

test('the session covers roughly 23 hours a weekday and none of Saturday', () => {
    // Sample every hour of one full week and compare the totals against the
    // published session length rather than against the implementation.
    let open = 0;
    const start = Date.UTC(2026, 0, 11); // Sunday
    for (let h = 0; h < 24 * 7; h++) {
        if (isMetalsMarketOpen(new Date(start + h * 3600_000))) open++;
    }
    // Sun 18:00->24:00 = 6, Mon-Thu 23 each = 92, Fri 00:00->17:00 = 17. Total 115.
    assert.equal(open, 115, `expected 115 open hours in a week, got ${open}`);
});
