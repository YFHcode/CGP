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
 * Largest gap in days still consistent with a daily series.
 *
 * Weekends give 3, a long weekend 4, and a public holiday adjoining one can
 * reach 5. Monthly sampling produces 28 or more, so anything in between is
 * unambiguous and the threshold is not delicately placed.
 */
const MAX_DAILY_GAP_DAYS = 7;

function daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Finds the trailing run of daily observations by walking backwards from the
 * most recent point until a gap too large to be a weekend or holiday appears.
 *
 * Backwards rather than forwards because the daily portion is always the
 * recent end — that is how the pipeline works — and a backwards walk needs no
 * lookahead heuristics to avoid being fooled by an isolated pair of adjacent
 * monthly samples.
 */
export function describeCoverage(series: SeriesPoint[]): CoverageFacts | null {
    if (!Array.isArray(series) || series.length === 0) return null;

    const start = series[0].date;
    const end = series[series.length - 1].date;

    let firstDailyIndex = series.length - 1;
    while (
        firstDailyIndex > 0 &&
        daysBetween(series[firstDailyIndex - 1].date, series[firstDailyIndex].date) <=
            MAX_DAILY_GAP_DAYS
    ) {
        firstDailyIndex -= 1;
    }

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
