/**
 * Diagnostic: describe an unknown price dataset and compare it to ours.
 *
 * Written for the Kaggle XAU/USD 2004-2024 set, but deliberately generic — it
 * takes a directory of CSVs and works out what they are, rather than assuming
 * a schema. Runs on a GitHub runner because the sandboxed dev environment
 * cannot reach Kaggle (the proxy denies CONNECT to www.kaggle.com), the same
 * reason probe-history-depth.mjs runs there.
 *
 * It answers one question: would this add anything we do not already hold?
 * That means four things, in order of how likely they are to kill the idea:
 *
 *  1. Does it cover dates we lack?
 *  2. Does it carry fields we lack (OHLC, volume) that we could actually use?
 *  3. Is it the same instrument as ours? Spot and futures differ by carry, so
 *     splicing them would put a step in the series.
 *  4. Is it clean — no duplicate rows, no weekend-dated bars, no spikes?
 *
 * Prints only. Never writes to data/.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIR = process.env.DATASET_DIR || 'dataset';
const OURS = process.env.OUR_HISTORY || 'data/history.json';
const OUR_SYMBOL = process.env.OUR_SYMBOL || 'XAU';

const fmt = (n, d = 2) =>
    Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '—';

/** Every file under DIR, recursively, with its size. */
function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else out.push({ path: full, size: st.size });
    }
    return out;
}

/** Minimal CSV split that respects double-quoted fields. */
function splitRow(line) {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
            if (c === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
            } else cur += c;
        } else if (c === '"') quoted = true;
        else if (c === ',' || c === ';' || c === '\t') { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
}

/**
 * Parses the date formats these exports actually use: ISO, MetaTrader's
 * dotted form, and US slashes, with or without a time component.
 */
function parseWhen(raw) {
    if (!raw) return null;
    const s = raw.trim().replace(/^"|"$/g, '');
    let m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s);
    if (m) return { date: `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`,
                    time: m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : null };
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s);
    if (m) return { date: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`,
                    time: m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : null };
    return null;
}

const findCol = (header, names) =>
    header.findIndex((h) => names.includes(h.toLowerCase().replace(/[^a-z]/g, '')));

function analyseCsv(path) {
    const text = readFileSync(path, 'utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { path, error: 'fewer than 2 lines' };

    const header = splitRow(lines[0]);
    const iDate = findCol(header, ['date', 'time', 'datetime', 'timestamp', 'gmttime', 'localtime']);
    const iOpen = findCol(header, ['open', 'o']);
    const iHigh = findCol(header, ['high', 'h']);
    const iLow = findCol(header, ['low', 'l']);
    const iClose = findCol(header, ['close', 'c', 'price', 'adjclose']);
    const iVol = findCol(header, ['volume', 'vol', 'tickvol', 'tickvolume']);

    const rows = [];
    let unparsedDates = 0;
    for (let i = 1; i < lines.length; i++) {
        const f = splitRow(lines[i]);
        const when = iDate >= 0 ? parseWhen(f[iDate]) : null;
        if (!when) { unparsedDates++; continue; }
        const num = (idx) => {
            if (idx < 0) return null;
            const v = Number(f[idx]);
            return Number.isFinite(v) ? v : null;
        };
        rows.push({ date: when.date, time: when.time, open: num(iOpen), high: num(iHigh),
                    low: num(iLow), close: num(iClose), volume: num(iVol) });
    }
    if (rows.length === 0) return { path, header, error: 'no parseable rows' };

    rows.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));

    // Granularity: the median gap between consecutive stamps.
    const gaps = [];
    for (let i = 1; i < Math.min(rows.length, 4000); i++) {
        const a = Date.parse(`${rows[i - 1].date}T${rows[i - 1].time ?? '00:00'}:00Z`);
        const b = Date.parse(`${rows[i].date}T${rows[i].time ?? '00:00'}:00Z`);
        if (b > a) gaps.push((b - a) / 60000);
    }
    gaps.sort((a, b) => a - b);
    const medianGapMin = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;

    const dates = new Set(rows.map((r) => r.date));
    const stamps = rows.map((r) => r.date + (r.time ?? ''));
    const dupes = stamps.length - new Set(stamps).size;
    const weekend = rows.filter((r) => {
        const d = new Date(`${r.date}T00:00:00Z`).getUTCDay();
        return d === 0 || d === 6;
    }).length;

    return {
        path, header, rows, unparsedDates, dupes, weekend, medianGapMin,
        distinctDates: dates.size,
        first: rows[0], last: rows[rows.length - 1],
        has: {
            open: iOpen >= 0, high: iHigh >= 0, low: iLow >= 0,
            close: iClose >= 0, volume: iVol >= 0,
        },
    };
}

// --- run ---------------------------------------------------------------------

console.log('='.repeat(78));
console.log('FILES');
console.log('='.repeat(78));
let files;
try {
    files = walk(DIR);
} catch (err) {
    console.error(`cannot read ${DIR}: ${err.message}`);
    process.exit(1);
}
for (const f of files.sort((a, b) => b.size - a.size)) {
    console.log(`  ${(f.size / 1024).toFixed(0).padStart(8)} KB  ${f.path}`);
}

const csvs = files.filter((f) => ['.csv', '.txt', '.tsv'].includes(extname(f.path).toLowerCase()));
if (csvs.length === 0) {
    console.log('\nNo CSV-like files found — nothing further to analyse.');
    process.exit(0);
}

const reports = [];
for (const f of csvs) {
    console.log(`\n${'='.repeat(78)}\n${f.path}\n${'='.repeat(78)}`);
    const r = analyseCsv(f.path);
    if (r.error) { console.log(`  ERROR: ${r.error}`); if (r.header) console.log(`  header: ${r.header.join(' | ')}`); continue; }
    reports.push(r);

    const g = r.medianGapMin;
    const gran = g === null ? 'unknown'
        : g < 60 ? `${g} minutes`
        : g < 1440 ? `${(g / 60).toFixed(1)} hours`
        : `${(g / 1440).toFixed(1)} days`;

    console.log(`  header      : ${r.header.join(' | ')}`);
    console.log(`  rows        : ${fmt(r.rows.length, 0)}  (${fmt(r.distinctDates, 0)} distinct dates)`);
    console.log(`  range       : ${r.first.date}${r.first.time ? ' ' + r.first.time : ''}  ->  ${r.last.date}${r.last.time ? ' ' + r.last.time : ''}`);
    console.log(`  granularity : ${gran} (median gap)`);
    console.log(`  fields      : ${Object.entries(r.has).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none recognised'}`);
    console.log(`  duplicates  : ${r.dupes}   weekend-dated rows: ${r.weekend}   unparseable dates: ${r.unparsedDates}`);
    console.log('  head:');
    for (const row of r.rows.slice(0, 3)) console.log(`    ${JSON.stringify(row)}`);
    console.log('  tail:');
    for (const row of r.rows.slice(-3)) console.log(`    ${JSON.stringify(row)}`);
}

// --- compare against what we already hold ------------------------------------

console.log(`\n${'='.repeat(78)}\nVERSUS OUR OWN SERIES (${OUR_SYMBOL} in ${OURS})\n${'='.repeat(78)}`);
let ours;
try {
    ours = JSON.parse(readFileSync(OURS, 'utf8')).series[OUR_SYMBOL];
} catch (err) {
    console.log(`  cannot read ours: ${err.message}`);
    process.exit(0);
}
const ourByDate = new Map(ours.map((p) => [p.date, p.close]));
console.log(`  ours        : ${fmt(ours.length, 0)} daily closes, ${ours[0].date} -> ${ours[ours.length - 1].date}`);

for (const r of reports) {
    // Collapse to one row per date (the last of the day) so intraday files
    // compare like-for-like against our daily closes.
    const theirs = new Map();
    for (const row of r.rows) if (row.close !== null) theirs.set(row.date, row.close);

    const newDates = [...theirs.keys()].filter((d) => !ourByDate.has(d)).sort();
    const common = [...theirs.keys()].filter((d) => ourByDate.has(d));

    const diffs = common
        .map((d) => Math.abs((theirs.get(d) - ourByDate.get(d)) / ourByDate.get(d)) * 100)
        .sort((a, b) => a - b);
    const median = diffs.length ? diffs[Math.floor(diffs.length / 2)] : null;
    const p90 = diffs.length ? diffs[Math.floor(diffs.length * 0.9)] : null;

    console.log(`\n  ${r.path}`);
    console.log(`    dates in common          : ${fmt(common.length, 0)}`);
    console.log(`    dates THEY have, we lack : ${fmt(newDates.length, 0)}` +
        (newDates.length ? `   e.g. ${newDates.slice(0, 5).join(', ')}` : ''));
    if (newDates.length) {
        const byYear = {};
        for (const d of newDates) byYear[d.slice(0, 4)] = (byYear[d.slice(0, 4)] ?? 0) + 1;
        console.log(`      by year: ${Object.entries(byYear).sort().map(([y, n]) => `${y}:${n}`).join(' ')}`);
    }
    console.log(`    close difference on common dates: median ${fmt(median, 3)}%, p90 ${fmt(p90, 3)}%`);
    if (median !== null) {
        console.log(`      ${median < 0.15
            ? '-> effectively the same instrument'
            : median < 1.5
              ? '-> close but not identical (likely spot vs futures, or a different close time)'
              : '-> a materially different series; splicing would put a step in the data'}`);
    }
}

console.log(`\n${'='.repeat(78)}\nDone. Nothing was written to data/.\n${'='.repeat(78)}`);
