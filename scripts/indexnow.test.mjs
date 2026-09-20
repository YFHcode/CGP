import test from 'node:test';
import assert from 'node:assert/strict';

import {
    slugForKey,
    changedDates,
    changedUrls,
    submitUrls,
    waitForDeploy,
    LIVE_PATHS,
    MAX_URLS_PER_REQUEST,
    SITE_URL,
    INDEXNOW_KEY,
} from './indexnow.mjs';

/**
 * The slug assertions below are literal strings, not a second implementation
 * of the slug rule. That is the point: this file exists because slugForKey is
 * duplicated from src/lib/history-periods.ts, and a mirror checked against
 * another mirror would agree with itself while both drifted from the routes
 * that actually resolve. "6-may-2010" is a URL that ranks today.
 */
test('slugForKey matches the live URL forms', () => {
    assert.equal(slugForKey('2010-05-06', 'day'), '6-may-2010');
    assert.equal(slugForKey('2026-09-18', 'day'), '18-september-2026');
    assert.equal(slugForKey('2024-01-01', 'day'), '1-january-2024');
    assert.equal(slugForKey('2010-05', 'month'), 'may-2010');
    assert.equal(slugForKey('2026-12', 'month'), 'december-2026');
    assert.equal(slugForKey('2010', 'year'), '2010');
});

test('slugForKey drops the leading zero on the day but keeps the month name full', () => {
    // "06-may-2010" and "6-may-2010" are different URLs; only the second is
    // canonical, and submitting the first would push a redirect.
    assert.equal(slugForKey('2010-05-06', 'day'), '6-may-2010');
    assert.notEqual(slugForKey('2010-05-06', 'day'), '06-may-2010');
});

test('slugForKey returns the key unchanged when it cannot parse it', () => {
    assert.equal(slugForKey('not-a-date', 'day'), 'not-a-date');
    assert.equal(slugForKey('2010-13', 'month'), '2010-13'); // no 13th month
});

test('changedDates reports new dates', () => {
    const previous = [{ date: '2026-09-17', close: 4381.1 }];
    const current = [
        { date: '2026-09-17', close: 4381.1 },
        { date: '2026-09-18', close: 4416.9 },
    ];
    assert.deepEqual(changedDates(previous, current), ['2026-09-18']);
});

test('changedDates reports a corrected close, not just a new one', () => {
    // A figure that changed silently is worse than a missing one: it sits in
    // an answer being wrong until something re-crawls it.
    const previous = [{ date: '2026-09-17', close: 4381.1 }];
    const current = [{ date: '2026-09-17', close: 4390.0 }];
    assert.deepEqual(changedDates(previous, current), ['2026-09-17']);
});

test('changedDates is empty when nothing moved', () => {
    const series = [
        { date: '2026-09-17', close: 4381.1 },
        { date: '2026-09-18', close: 4416.9 },
    ];
    assert.deepEqual(changedDates(series, series), []);
});

test('changedDates treats a missing previous series as everything being new', () => {
    const current = [{ date: '2026-09-18', close: 4416.9 }];
    assert.deepEqual(changedDates(undefined, current), ['2026-09-18']);
    assert.deepEqual(changedDates(null, current), ['2026-09-18']);
});

test('changedDates ignores dates that disappeared', () => {
    const previous = [
        { date: '2026-09-17', close: 4381.1 },
        { date: '2026-09-18', close: 4416.9 },
    ];
    const current = [{ date: '2026-09-17', close: 4381.1 }];
    assert.deepEqual(changedDates(previous, current), []);
});

test('changedDates skips malformed points rather than submitting undefined', () => {
    const current = [null, {}, { date: 42, close: 1 }, { date: '2026-09-18', close: 4416.9 }];
    assert.deepEqual(changedDates([], current), ['2026-09-18']);
});

test('changedUrls always includes the live pages', () => {
    const urls = changedUrls({ previous: {}, current: {} });
    for (const path of LIVE_PATHS) {
        const expected = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
        assert.ok(urls.includes(expected), `missing ${expected}`);
    }
});

test('changedUrls emits the homepage bare and no path with a trailing slash', () => {
    // Next runs with trailingSlash:false here, so "/gold-price-today/" is a
    // 308 and submitting it wastes the push.
    const urls = changedUrls({ previous: {}, current: {} });
    assert.ok(urls.includes('https://www.chartgoldprice.com'));
    for (const url of urls) {
        assert.ok(!url.endsWith('/'), `${url} ends with a slash`);
    }
});

test('a changed day drags its month and year page with it', () => {
    const urls = changedUrls({
        previous: { XAU: [] },
        current: { XAU: [{ date: '2010-05-06', close: 1210 }] },
    });

    assert.ok(urls.includes(`${SITE_URL}/gold-price/6-may-2010`));
    assert.ok(urls.includes(`${SITE_URL}/gold-price/may-2010`));
    assert.ok(urls.includes(`${SITE_URL}/gold-price/2010`));
});

test('each metal gets its own archive routes', () => {
    const urls = changedUrls({
        previous: {},
        current: {
            XAU: [{ date: '2026-09-18', close: 4416.9 }],
            XAG: [{ date: '2026-09-18', close: 56.85 }],
        },
    });

    assert.ok(urls.includes(`${SITE_URL}/gold-price/18-september-2026`));
    assert.ok(urls.includes(`${SITE_URL}/silver-price/18-september-2026`));
});

test('minor metals in the snapshot produce no archive URLs', () => {
    // history.json carries XPT and XPD, but there are no /platinum-price/<day>
    // routes — emitting them would submit 404s.
    const urls = changedUrls({
        previous: {},
        current: { XPT: [{ date: '2026-09-18', close: 1500 }] },
    });
    assert.equal(urls.length, LIVE_PATHS.length);
});

test('two changed days in one month yield one month page, not two', () => {
    const urls = changedUrls({
        previous: {},
        current: {
            XAU: [
                { date: '2026-09-17', close: 4381.1 },
                { date: '2026-09-18', close: 4416.9 },
            ],
        },
    });

    const monthPages = urls.filter((u) => u === `${SITE_URL}/gold-price/september-2026`);
    assert.equal(monthPages.length, 1);
    assert.equal(new Set(urls).size, urls.length, 'urls should be unique');
});

test('the archive cap keeps the newest changes and drops the oldest', () => {
    // A backfill changes thousands of historical days at once. Those edits are
    // real but not urgent; the recent ones are what a push is for.
    const current = {
        XAU: [
            { date: '2011-01-03', close: 1400 },
            { date: '2011-01-04', close: 1410 },
            { date: '2026-09-18', close: 4416.9 },
        ],
    };

    const urls = changedUrls({ previous: {}, current, maxArchive: 3 });
    const archive = urls.filter((u) => u.includes('/gold-price/'));

    assert.equal(archive.length, 3);
    assert.deepEqual(archive, [
        `${SITE_URL}/gold-price/18-september-2026`,
        `${SITE_URL}/gold-price/2026`,
        `${SITE_URL}/gold-price/september-2026`,
    ]);
    assert.ok(!urls.some((u) => u.includes('2011')), 'the 2011 pages should have been dropped');
});

test('submitUrls posts the documented payload', async () => {
    let seen = null;
    const fetchImpl = async (url, init) => {
        seen = { url, init };
        return { status: 200, statusText: 'OK', text: async () => '' };
    };

    const result = await submitUrls([`${SITE_URL}/gold-price-today`], { fetchImpl });

    assert.equal(result.submitted, 1);
    assert.equal(seen.url, 'https://api.indexnow.org/indexnow');
    assert.equal(seen.init.method, 'POST');

    const body = JSON.parse(seen.init.body);
    assert.equal(body.host, 'www.chartgoldprice.com');
    assert.equal(body.key, INDEXNOW_KEY);
    assert.equal(body.keyLocation, `${SITE_URL}/${INDEXNOW_KEY}.txt`);
    assert.deepEqual(body.urlList, [`${SITE_URL}/gold-price-today`]);
});

test('submitUrls treats 202 as success', async () => {
    // 202 is what the very first submission gets while the key file is still
    // being validated. Failing the run on it would make the first run red.
    const fetchImpl = async () => ({ status: 202, statusText: 'Accepted', text: async () => '' });
    const result = await submitUrls([`${SITE_URL}/`], { fetchImpl });
    assert.equal(result.status, 202);
});

test('submitUrls throws when the key is rejected', async () => {
    const fetchImpl = async () => ({ status: 403, statusText: 'Forbidden', text: async () => 'key not valid' });
    await assert.rejects(() => submitUrls([`${SITE_URL}/`], { fetchImpl }), /403.*key not valid/);
});

test('submitUrls sends nothing when there is nothing to send', async () => {
    let called = false;
    const fetchImpl = async () => {
        called = true;
        return { status: 200, statusText: 'OK', text: async () => '' };
    };

    const result = await submitUrls([], { fetchImpl });
    assert.equal(result.submitted, 0);
    assert.equal(called, false, 'an empty batch should not hit the network');
});

test('submitUrls refuses a batch over the protocol limit', async () => {
    const urls = Array.from({ length: MAX_URLS_PER_REQUEST + 1 }, (_, i) => `${SITE_URL}/p${i}`);
    await assert.rejects(() => submitUrls(urls, { fetchImpl: async () => ({}) }), /at most 10000/);
});

test('waitForDeploy returns true once the live snapshot matches', async () => {
    let calls = 0;
    const fetchImpl = async () => {
        calls += 1;
        return {
            ok: true,
            json: async () => ({ meta: { updated_at: calls < 3 ? 'old' : 'new' } }),
        };
    };

    const live = await waitForDeploy({
        expectedUpdatedAt: 'new',
        fetchImpl,
        intervalMs: 0,
        sleep: async () => {},
        log: () => {},
    });

    assert.equal(live, true);
    assert.equal(calls, 3);
});

test('waitForDeploy gives up rather than pinging a stale deploy', async () => {
    let now = 0;
    const fetchImpl = async () => ({ ok: true, json: async () => ({ meta: { updated_at: 'old' } }) });

    const live = await waitForDeploy({
        expectedUpdatedAt: 'new',
        fetchImpl,
        timeoutMs: 100,
        intervalMs: 30,
        now: () => (now += 30),
        sleep: async () => {},
        log: () => {},
    });

    assert.equal(live, false);
});

test('waitForDeploy survives a throwing fetch and a bad status', async () => {
    let calls = 0;
    const fetchImpl = async () => {
        calls += 1;
        if (calls === 1) throw new Error('ECONNRESET');
        if (calls === 2) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ meta: { updated_at: 'new' } }) };
    };

    const live = await waitForDeploy({
        expectedUpdatedAt: 'new',
        fetchImpl,
        intervalMs: 0,
        sleep: async () => {},
        log: () => {},
    });

    assert.equal(live, true);
    assert.equal(calls, 3);
});
