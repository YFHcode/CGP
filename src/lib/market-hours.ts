/**
 * When the metals market is actually trading.
 *
 * A live ticker that keeps polling through the weekend is worse than useless:
 * it burns the visitor's battery and the provider's goodwill to re-fetch a
 * number that cannot have changed, and it quietly tells the user "this is
 * live" while showing a price frozen since Friday. Knowing the session lets
 * the UI say "market closed" honestly and stop asking.
 *
 * COMEX metals (GC, SI) trade Sunday 18:00 ET through Friday 17:00 ET, with a
 * 60-minute maintenance break each weekday beginning at 17:00 ET.
 *
 * Times are evaluated in America/New_York via Intl rather than by applying a
 * fixed UTC offset, so the DST transitions are handled by the platform's tz
 * database instead of by arithmetic that would be wrong for half the year.
 */

export interface EasternParts {
    /** 0 = Sunday … 6 = Saturday, in Eastern time. */
    weekday: number;
    hour: number;
    minute: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

const ET_FORMAT = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

/** Splits an instant into Eastern weekday/hour/minute. */
export function easternParts(date: Date): EasternParts {
    const parts = ET_FORMAT.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
        weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
        hour: Number(get('hour')),
        minute: Number(get('minute')),
    };
}

/**
 * True while COMEX metals are trading.
 *
 * Deliberately ignores exchange holidays: the holiday calendar changes yearly
 * and a hardcoded list silently rots. Being open-by-mistake on a holiday costs
 * a few wasted polls that return an unchanged price; being closed-by-mistake
 * would freeze a genuinely live ticker, which is the worse failure.
 */
export function isMetalsMarketOpen(date: Date = new Date()): boolean {
    const { weekday, hour } = easternParts(date);

    // Saturday: shut all day.
    if (weekday === 6) return false;
    // Sunday: reopens at 18:00 ET.
    if (weekday === 0) return hour >= 18;
    // Friday: closes at 17:00 ET and stays shut for the weekend.
    if (weekday === 5) return hour < 17;
    // Monday–Thursday: trading except the 17:00–18:00 ET break.
    return hour !== 17;
}

/**
 * Human-readable reason the ticker is idle, or null while trading.
 * Used for the UI label so a frozen price is always explained.
 */
export function marketClosedReason(date: Date = new Date()): string | null {
    if (isMetalsMarketOpen(date)) return null;
    const { weekday, hour } = easternParts(date);
    if (weekday === 6 || weekday === 0 || (weekday === 5 && hour >= 17)) {
        return 'Market closed for the weekend';
    }
    return 'Daily trading break';
}
