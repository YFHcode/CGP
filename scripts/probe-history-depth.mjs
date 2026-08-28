#!/usr/bin/env node
/**
 * Answers one question: can we get true daily history back to 2000?
 *
 * The stored series is monthly from 2000 and only daily from mid-2024, which
 * matters because 60% of the year-specific search demand this site receives
 * points at pre-2024 years. The pipeline already asks Yahoo for
 * `range=max&interval=1d`, so either Yahoo downsamples long ranges, or the old
 * monthly portion is legacy data that mergeSeries preserves and Yahoo never
 * actually supplied.
 *
 * This probe distinguishes those cases and tests the fix — fetching in
 * explicit period1/period2 windows instead of one `max` request — without
 * writing anything to data/. It only reports.
 *
 * It has to run in CI: Yahoo is unreachable from the sandboxed dev
 * environment, so this is the only place the question can be settled.
 */

const YAHOO = process.env.YAHOO_URL || 'https://query1.finance.yahoo.com/v8/finance/chart';
const SYMBOLS = (process.env.PROBE_SYMBOLS || 'GC=F,SI=F').split(',');
const TIMEOUT_MS = 30000;

/** Windows to test the period1/period2 approach against. */
const WINDOW_YEARS = Number(process.env.PROBE_WINDOW_YEARS || 2);
const START_YEAR = Number(process.env.PROBE_START_YEAR || 2000);

const lines = [];
function log(s = '') {
    console.log(s);
    lines.push(s);
}

async function fetchJson(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChartGoldPrice/1.0)' },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
}

/** Yahoo chart payload -> ascending [{date, close}], nulls dropped. */
function parseChart(payload) {
    const result = payload?.chart?.result?.[0];
    const stamps = result?.timestamp;
    const closes = result?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(stamps) || !Array.isArray(closes)) return [];

    const byDate = new Map();
    for (let i = 0; i < stamps.length; i++) {
        const close = closes[i];
        if (typeof close !== 'number' || !Number.isFinite(close)) continue;
        const date = new Date(stamps[i] * 1000).toISOString().slice(0, 10);
        byDate.set(date, close);
    }
    return [...byDate.entries()].map(([date, close]) => ({ date, close })).sort((a, b) =>
        a.date < b.date ? -1 : 1
    );
}

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Classifies a series by its typical gap. A daily series is dominated by gaps
 * of 1-4 days (weekends, holidays); a monthly one by gaps of 28+.
 */
function cadence(points) {
    if (points.length < 3) return { label: 'too few points', daily: 0, monthly: 0 };
    let daily = 0;
    let monthly = 0;
    for (let i = 1; i < points.length; i++) {
        const gap = days(points[i - 1].date, points[i].date);
        if (gap <= 7) daily++;
        else if (gap >= 28) monthly++;
    }
    const total = points.length - 1;
    const label =
        daily / total > 0.9 ? 'DAILY' : monthly / total > 0.5 ? 'MONTHLY' : 'MIXED';
    return { label, daily, monthly, total };
}

function summarise(points) {
    if (points.length === 0) return 'no usable rows';
    const c = cadence(points);
    return `${points.length} pts  ${points[0].date} -> ${points[points.length - 1].date}  ${c.label} (${c.daily} short gaps / ${c.monthly} monthly gaps)`;
}

async function probeSymbol(symbol) {
    log(`\n## ${symbol}`);
    log('');

    // --- 1. What `range=max` actually returns, which is what we do today ----
    let maxPoints = [];
    try {
        const payload = await fetchJson(
            `${YAHOO}/${encodeURIComponent(symbol)}?range=max&interval=1d`
        );
        maxPoints = parseChart(payload);
        log(`range=max&interval=1d  ->  ${summarise(maxPoints)}`);

        // Cadence of only the pre-2024 portion, which is the part in question.
        const old = maxPoints.filter((p) => p.date < '2024-01-01');
        log(`  pre-2024 portion     ->  ${summarise(old)}`);
    } catch (error) {
        log(`range=max FAILED: ${error.message ?? error}`);
    }

    // --- 2. Does an explicit old window return daily data? -----------------
    const windows = [];
    const thisYear = new Date().getUTCFullYear();
    for (let y = START_YEAR; y <= thisYear; y += WINDOW_YEARS) {
        const from = Date.UTC(y, 0, 1) / 1000;
        const to = Math.min(Date.UTC(y + WINDOW_YEARS, 0, 1) / 1000, Date.now() / 1000);
        windows.push({ label: `${y}-${Math.min(y + WINDOW_YEARS - 1, thisYear)}`, from, to });
    }

    log('');
    log(`windowed period1/period2 (${WINDOW_YEARS}-year windows, ${windows.length} requests):`);

    const merged = new Map();
    let failures = 0;
    for (const w of windows) {
        try {
            const payload = await fetchJson(
                `${YAHOO}/${encodeURIComponent(symbol)}?period1=${Math.floor(w.from)}&period2=${Math.floor(w.to)}&interval=1d`
            );
            const pts = parseChart(payload);
            for (const p of pts) merged.set(p.date, p.close);
            const c = cadence(pts);
            log(`  ${w.label}  ${String(pts.length).padStart(5)} pts  ${c.label}`);
        } catch (error) {
            failures++;
            log(`  ${w.label}  FAILED: ${error.message ?? error}`);
        }
        // Be a polite client: Yahoo is keyless and unmetered, don't hammer it.
        await new Promise((r) => setTimeout(r, 400));
    }

    const all = [...merged.entries()]
        .map(([date, close]) => ({ date, close }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));

    log('');
    log(`windowed TOTAL         ->  ${summarise(all)}`);
    if (failures) log(`  (${failures} window(s) failed)`);

    // --- 3. The verdict, stated as a comparison ----------------------------
    const oldWindowed = all.filter((p) => p.date < '2024-01-01');
    const oldMax = maxPoints.filter((p) => p.date < '2024-01-01');
    const gain = oldWindowed.length - oldMax.length;

    log('');
    log(`pre-2024 points: range=max ${oldMax.length}  vs  windowed ${oldWindowed.length}  (${gain >= 0 ? '+' : ''}${gain})`);
    const verdict =
        cadence(oldWindowed).label === 'DAILY' && gain > 500
            ? 'WORTH DOING — windowing returns true daily history the current call does not'
            : oldWindowed.length === 0
              ? 'INCONCLUSIVE — windowed requests returned nothing for the old period'
              : 'NOT WORTH DOING — windowing gives no meaningful gain over range=max';
    log(`VERDICT: ${verdict}`);

    return { symbol, oldMax: oldMax.length, oldWindowed: oldWindowed.length, verdict };
}

const results = [];
log('# Yahoo history depth probe');
log('');
log('Question: can we get true daily closes back to 2000, or is the pre-2024');
log('monthly resolution a hard limit of the source?');

for (const symbol of SYMBOLS) {
    try {
        results.push(await probeSymbol(symbol.trim()));
    } catch (error) {
        log(`\n## ${symbol}\nprobe threw: ${error.message ?? error}`);
    }
}

log('');
log('## Summary');
log('');
log('| symbol | pre-2024 pts (range=max) | pre-2024 pts (windowed) | verdict |');
log('| --- | --- | --- | --- |');
for (const r of results) {
    log(`| ${r.symbol} | ${r.oldMax} | ${r.oldWindowed} | ${r.verdict.split(' — ')[0]} |`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}

// Never fail the job: this is a question, not a health check.
process.exit(0);
