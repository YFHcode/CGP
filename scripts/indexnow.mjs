#!/usr/bin/env node
/**
 * Submits changed URLs to IndexNow after a data refresh has deployed.
 *
 * IndexNow is a push protocol: instead of waiting for a crawler to notice that
 * a page changed, the site tells the engines. One POST reaches every
 * participating engine — Bing, Yandex, Seznam, Naver — and Bing's index is
 * what grounds Copilot and, through Microsoft's own grounding APIs, other
 * assistants besides. For a site whose whole value is a price that moves twice
 * a day, the lag between "the number changed" and "the engine knows" is the
 * thing worth attacking, and it is free to attack.
 *
 * Two rules shape everything below.
 *
 * 1. Only submit what actually changed. The archive is ~13,700 pages and
 *    almost all of them are historical: the close for 6 May 2010 is the same
 *    today as it was last week. Re-submitting them on a schedule is the
 *    behaviour IndexNow's abuse handling exists to stop, and it would teach
 *    the engines to ignore us. So the changed set is computed by diffing the
 *    previous snapshot against the new one.
 *
 * 2. Never submit before the change is live. The refresh commits JSON and
 *    Vercel then rebuilds; pinging at commit time invites a crawl of the old
 *    page and wastes the one signal we get. So this waits for the deployed
 *    /api/data to report the new timestamp, and declines to submit at all if
 *    it never does.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SITE_URL = 'https://www.chartgoldprice.com';
export const INDEXNOW_KEY = '87781896844f306da6f7cf74025c13df';
export const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
export const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** The protocol's own ceiling for one request. */
export const MAX_URLS_PER_REQUEST = 10000;

/**
 * How many changed archive pages one run may submit.
 *
 * A normal refresh changes one or two days per metal. A history backfill can
 * change thousands at once, and those changes are real — but they are also
 * pages about 2011, with no reader waiting on them. Pushing 6,000 URLs at an
 * engine to correct a decade-old close is the wrong shape of request; the
 * sitemap's lastmod is the right channel for that, and it costs nothing to
 * wait for the next crawl. The most recent changes are the ones that benefit
 * from being pushed, so that is what the cap keeps.
 */
export const MAX_ARCHIVE_URLS = 200;

const MONTH_SLUGS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Pages whose substance is the current price, so every refresh changes them.
 *
 * Deliberately not every page that happens to render a price. The calculators
 * and the per-unit pages carry one as an input default, which is not a reason
 * to tell four search engines to re-crawl them twice a day. These are the
 * pages where the number *is* the content.
 */
export const LIVE_PATHS = [
    '/',
    '/gold-price-today',
    '/silver-price-today',
    '/gold-price',
    '/silver-price',
    '/platinum-price',
    '/palladium-price',
    '/gold-to-silver-ratio',
    '/gold-price-history',
    '/silver-price-history',
    '/gold-price-insights',
    '/silver-price-insights',
    '/gold-price-forecast',
    '/silver-price-forecast',
];

const METAL_ROUTES = { XAU: '/gold-price', XAG: '/silver-price' };

/**
 * Mirrors slugForKey in src/lib/history-periods.ts.
 *
 * Duplicated rather than imported because that file is TypeScript behind an
 * `@/` alias and this script runs as plain node in CI, the same arrangement
 * refresh-data.mjs already uses. The risk of the two drifting is real, so
 * indexnow.test.mjs asserts the slugs against literal expected strings taken
 * from live URLs rather than against a re-implementation.
 */
export function slugForKey(key, kind) {
    if (kind === 'year') return key;

    const match = DAY_RE.exec(kind === 'month' ? `${key}-01` : key);
    if (!match) return key;

    const monthName = MONTH_SLUGS[Number(match[2]) - 1];
    if (!monthName) return key;

    return kind === 'month'
        ? `${monthName}-${match[1]}`
        : `${Number(match[3])}-${monthName}-${match[1]}`;
}

/**
 * ISO dates whose close is new or different between two series.
 *
 * A changed close matters as much as a new one: a corrected figure that no
 * engine re-crawls is a wrong figure sitting in an answer. Dates that vanish
 * from the series are ignored on purpose — the page still exists, and if the
 * point was dropped as a bad tick the page it becomes (a closed-day page, or
 * a neighbouring session) is not urgent enough to spend a push on.
 */
export function changedDates(previous, current) {
    const before = new Map((previous ?? []).map((p) => [p.date, p.close]));
    const changed = [];

    for (const point of current ?? []) {
        if (!point || typeof point.date !== 'string') continue;
        if (before.get(point.date) !== point.close) changed.push(point.date);
    }

    return changed;
}

/**
 * The full set of URLs one refresh should push, newest archive page first.
 *
 * A changed day drags its month and its year with it, because those pages
 * aggregate it — the September 2026 page's high is wrong the moment a new
 * September close lands, and it is a page people actually search for.
 */
export function changedUrls({ previous, current, siteUrl = SITE_URL, maxArchive = MAX_ARCHIVE_URLS }) {
    const archive = new Map(); // path -> sort key, so a month page sorts by its newest day

    for (const [symbol, base] of Object.entries(METAL_ROUTES)) {
        const dates = changedDates(previous?.[symbol], current?.[symbol]);

        for (const date of dates) {
            const match = DAY_RE.exec(date);
            if (!match) continue;

            const [, year, month] = match;
            const entries = [
                [`${base}/${slugForKey(date, 'day')}`, date],
                [`${base}/${slugForKey(`${year}-${month}`, 'month')}`, date],
                [`${base}/${year}`, date],
            ];

            for (const [path, sortKey] of entries) {
                const existing = archive.get(path);
                if (existing === undefined || sortKey > existing) archive.set(path, sortKey);
            }
        }
    }

    const archivePaths = [...archive.entries()]
        .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0]) : b[1].localeCompare(a[1])))
        .slice(0, maxArchive)
        .map(([path]) => path);

    // When the history did not move at all — a refresh that only changed the
    // spot price — archivePaths is empty and the live pages are the whole
    // batch, which is correct rather than a degenerate case.
    //
    // No trailing slashes: the site runs Next's default trailingSlash:false,
    // every canonical and every sitemap entry is the bare path, and submitting
    // "/gold-price-today/" would hand the engines a URL that 308s. The
    // homepage is SITE_URL itself, exactly as sitemap.ts emits it.
    return [...LIVE_PATHS, ...archivePaths].map((path) =>
        path === '/' ? siteUrl : `${siteUrl}${path}`
    );
}

/**
 * Waits until the deployed API reports the timestamp we just committed.
 *
 * Returns true once it matches, false if it never does. False means "do not
 * submit": a ping that arrives before the deploy is worse than no ping,
 * because the engine crawls the old page and has no reason to come back.
 */
export async function waitForDeploy({
    expectedUpdatedAt,
    siteUrl = SITE_URL,
    timeoutMs = 15 * 60 * 1000,
    intervalMs = 30 * 1000,
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log = console.log,
}) {
    const deadline = now() + timeoutMs;

    while (now() < deadline) {
        try {
            // Unique query string so the CDN cannot answer from an edge copy
            // built before this deploy. The route ignores unknown params.
            const response = await fetchImpl(`${siteUrl}/api/data?indexnow=${now()}`, {
                cache: 'no-store',
                headers: { 'cache-control': 'no-cache' },
            });

            if (response.ok) {
                const body = await response.json();
                const live = body?.meta?.updated_at ?? null;
                if (live === expectedUpdatedAt) return true;
                log(`[indexnow] deployed snapshot is ${live}, waiting for ${expectedUpdatedAt}`);
            } else {
                log(`[indexnow] /api/data answered ${response.status}; retrying`);
            }
        } catch (error) {
            log(`[indexnow] could not reach /api/data: ${error instanceof Error ? error.message : error}`);
        }

        await sleep(intervalMs);
    }

    return false;
}

/**
 * POSTs one batch to the shared IndexNow endpoint, which fans out to every
 * participating engine — so this is not "the Bing submission", it is all of
 * them.
 *
 * 200 and 202 are both success: 202 means the key is accepted but still being
 * validated, which is the expected answer on the very first submission.
 */
export async function submitUrls(urls, {
    key = INDEXNOW_KEY,
    keyLocation = KEY_LOCATION,
    siteUrl = SITE_URL,
    endpoint = ENDPOINT,
    fetchImpl = fetch,
} = {}) {
    if (urls.length === 0) return { submitted: 0, status: null };
    if (urls.length > MAX_URLS_PER_REQUEST) {
        throw new Error(`IndexNow accepts at most ${MAX_URLS_PER_REQUEST} URLs per request, got ${urls.length}`);
    }

    const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            host: new URL(siteUrl).host,
            key,
            keyLocation,
            urlList: urls,
        }),
    });

    const body = await response.text().catch(() => '');
    if (response.status !== 200 && response.status !== 202) {
        throw new Error(`IndexNow rejected the batch: ${response.status} ${response.statusText} ${body}`.trim());
    }

    return { submitted: urls.length, status: response.status };
}

async function readJson(path, fallback = null) {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch {
        return fallback;
    }
}

async function main() {
    // The workflow stashes the pre-refresh history before running the refresh,
    // because after the commit there is no other copy of it to diff against.
    const previousPath = process.argv[2];
    if (!previousPath) {
        console.error('Usage: node scripts/indexnow.mjs <path-to-previous-history.json>');
        process.exit(2);
    }

    const previous = await readJson(previousPath, { series: {} });
    const current = await readJson(join(ROOT, 'data', 'history.json'), { series: {} });
    const prices = await readJson(join(ROOT, 'data', 'prices.json'), {});

    const urls = changedUrls({ previous: previous?.series, current: current?.series });
    console.log(`[indexnow] ${urls.length} URL(s) to submit`);
    for (const url of urls) console.log(`  ${url}`);

    if (process.env.INDEXNOW_DRY_RUN === 'true') {
        console.log('[indexnow] dry run — not submitting');
        return;
    }

    if (!prices?.updatedAt) {
        console.warn('[indexnow] no updatedAt in prices.json; refusing to submit blind');
        return;
    }

    const live = await waitForDeploy({ expectedUpdatedAt: prices.updatedAt });
    if (!live) {
        // Not a failure worth failing the run over. The sitemap still carries
        // these pages and the next refresh will push them; a red X on the data
        // refresh would be a worse outcome than a missed ping.
        console.warn('[indexnow] deploy did not go live in time; skipping submission');
        return;
    }

    const result = await submitUrls(urls);
    console.log(`[indexnow] submitted ${result.submitted} URL(s), HTTP ${result.status}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('[indexnow]', error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
