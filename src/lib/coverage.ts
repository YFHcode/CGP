/**
 * What the historical series actually contains.
 *
 * The site had been describing the archive as "25+ years of daily closes"
 * everywhere — API docs, llms.txt, Dataset markup. It isn't. The committed
 * series runs monthly from 2000 and only switches to daily cadence partway
 * through; the daily tail is a small fraction of the record. Anyone who
 * divided the point count by the year span would have caught the
 * contradiction immediately, which is exactly what a data consumer arriving
 * from Dataset Search or an OpenAPI directory does.
 *
 * So the cadence is derived from the series rather than asserted in prose.
 * Prose drifts silently when the pipeline changes; this cannot.
 */

export interface SeriesPoint {
    date: string;
}

export interface CoverageFacts {
    /** First date in the record. */
    start: string;
    /** Last date in the record. */
    end: string;
    points: number;
    /** First date of the trailing daily-cadence run, or null if there is none. */
    dailyFrom: string | null;
    dailyPoints: number;
    /** Human-readable cadence, e.g. "monthly closes from … then daily closes from …". */
    sentence: string;
    /** Compact form for titles and meta descriptions. */
    summary: string;
}

/**
 * Minimum observations in a year for that year to count as daily.
 *
 * A trading year holds roughly 250 sessions and a monthly sample 12, so this
 * sits far from both and is not a delicate judgement.
 */
const MIN_DAILY_PER_YEAR = 100;

function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * First year from which the record stays daily through to the end.
 *
 * Density per year, not a backwards walk over gaps. The original walked back
 * from the newest point while every gap stayed under a week, which was correct
 * while the archive really was monthly-then-daily. Once it was backfilled to
 * true daily history that broke: seven isolated gaps of 8 to 27 days —
 * exchange holidays and small holes upstream — halted the walk, so a
 * 6,450-point daily series was still being described as "monthly closes from
 * 2000, then daily from 2024". Counting per year tolerates those holes,
 * because one missing fortnight does not take a year under 100 sessions.
 */
function firstDailyIndexByDensity(series: SeriesPoint[]): number {
    const byYear = new Map<string, { count: number; first: string; last: string }>();
    for (const point of series) {
        const date = String(point?.date ?? '');
        const year = date.slice(0, 4);
        if (year.length !== 4) continue;
        const entry = byYear.get(year);
        if (entry) {
            entry.count++;
            if (date < entry.first) entry.first = date;
            if (date > entry.last) entry.last = date;
        } else {
            byYear.set(year, { count: 1, first: date, last: date });
        }
    }
    if (byYear.size === 0) return series.length;

    /**
     * Density is judged against the span a year actually covers, not the whole
     * calendar year. The first and last years of any record are partial by
     * definition — this series starts on 30 August 2000 and so holds 84
     * sessions that year — and a flat annual threshold would reject them as
     * "not daily" when 84 sessions across four months is exactly daily.
     */
    const isDense = (entry: { count: number; first: string; last: string }) => {
        const span = Math.max(1, daysBetween(entry.first, entry.last) + 1);
        const expected = (MIN_DAILY_PER_YEAR * span) / 365;
        return entry.count >= Math.max(10, expected);
    };

    const years = [...byYear.keys()].sort();
    let firstYear: string | null = null;
    for (let i = years.length - 1; i >= 0; i--) {
        const entry = byYear.get(years[i]);
        if (!entry || !isDense(entry)) break;
        firstYear = years[i];
    }
    if (firstYear === null) return series.length;

    const index = series.findIndex((p) => p.date.slice(0, 4) === firstYear);
    return index >= 0 ? index : series.length;
}

export function describeCoverage(series: SeriesPoint[]): CoverageFacts | null {
    if (!Array.isArray(series) || series.length === 0) return null;

    const start = series[0].date;
    const end = series[series.length - 1].date;

    const firstDailyIndex = firstDailyIndexByDensity(series);

    // A lone trailing point is not a cadence. Require at least a couple of
    // weeks of consecutive observations before calling anything "daily".
    const dailyPoints = series.length - firstDailyIndex;
    const hasDailyRun = dailyPoints >= 10;

    const dailyFrom = hasDailyRun ? series[firstDailyIndex].date : null;
    const coversWholeRecord = hasDailyRun && firstDailyIndex === 0;

    let sentence: string;
    let summary: string;

    if (coversWholeRecord) {
        sentence = `daily closes from ${start} to ${end}`;
        summary = 'daily closes';
    } else if (dailyFrom) {
        sentence =
            `monthly closes from ${start}, then daily closes from ${dailyFrom} ` +
            `through ${end}`;
        summary = `monthly closes back to ${start.slice(0, 4)}, daily closes since ${dailyFrom.slice(0, 4)}`;
    } else {
        sentence = `monthly closes from ${start} to ${end}`;
        summary = 'monthly closes';
    }

    return {
        start,
        end,
        points: series.length,
        dailyFrom,
        dailyPoints: hasDailyRun ? dailyPoints : 0,
        sentence,
        summary,
    };
}

/** Year span of the record, for prose like "over 25 years". */
export function coverageYears(facts: CoverageFacts): number {
    return Math.floor(daysBetween(facts.start, facts.end) / 365.25);
}
