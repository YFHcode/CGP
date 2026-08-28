import type { DayProfile, DayCharacter } from './day-character';

/**
 * Turns a day's profile into prose and questions that differ between days.
 *
 * The point is structural, not decorative. Every day page previously rendered
 * the same seven questions and the same paragraph shapes, so after stripping
 * dates and numbers they were 90-100% identical to each other. Selecting from
 * a pool by character means a record-high day and a quiet range-bound day no
 * longer share a skeleton: different sections appear, in different orders,
 * asking different things.
 *
 * Each entry says something only true of that kind of session, so this reads
 * as explanation rather than as synonym-cycling — which would be the same
 * duplication problem wearing a hat.
 */

export interface NarrativeBlock {
    heading: string;
    body: string;
}

const pct = (value: number) => `${Math.abs(value).toFixed(2)}%`;

/** Roughly 250 sessions a year, used to phrase gaps in human terms. */
function sessionsAsSpan(sessions: number): string {
    if (sessions < 5) return `${sessions} session${sessions === 1 ? '' : 's'}`;
    if (sessions < 22) return `about ${Math.round(sessions / 5)} week${sessions < 10 ? '' : 's'}`;
    if (sessions < 250) return `about ${Math.round(sessions / 21)} months`;
    const years = sessions / 250;
    return years < 1.5 ? 'about a year' : `about ${years.toFixed(0)} years`;
}

/**
 * The lead block, chosen by character.
 *
 * Ordered by how much a reader would care: a record is the story, a big move
 * is the story, and only when neither applies does position-in-range become
 * the most interesting true thing to say.
 */
export function leadBlock(profile: DayProfile, metalName: string): NarrativeBlock | null {
    const lower = metalName.toLowerCase();
    const { character, streak, sessionsSinceHigher, sessionsSinceLower } = profile;

    switch (character) {
        case 'record-high':
            return {
                heading: 'A record close',
                body:
                    `No session before this one closed higher — this was the highest ${lower} ` +
                    `close on record at the time. Records tend to cluster, so the days either ` +
                    `side are worth reading together rather than in isolation.`,
            };
        case 'record-low':
            return {
                heading: 'A record low close',
                body:
                    `No earlier session closed lower. Lows on this scale usually mark the end ` +
                    `of a long decline rather than a single bad day, so the surrounding weeks ` +
                    `carry more information than this close alone.`,
            };
        case 'high-since':
            return {
                heading: 'Highest in a long while',
                body: sessionsSinceHigher
                    ? `${metalName} had not closed this high for ${sessionsAsSpan(sessionsSinceHigher)}. ` +
                      `Reclaiming a level after that long usually says more about the trend than ` +
                      `the size of the day's move does.`
                    : `${metalName} reclaimed a level it had not seen in a long time.`,
            };
        case 'low-since':
            return {
                heading: 'Lowest in a long while',
                body: sessionsSinceLower
                    ? `${metalName} had not closed this low for ${sessionsAsSpan(sessionsSinceLower)}. ` +
                      `Breaking below a level held that long is the kind of move that tends to ` +
                      `set the tone for the sessions that follow.`
                    : `${metalName} fell to a level it had not touched in a long time.`,
            };
        case 'surge':
            return {
                heading: 'A large single-session gain',
                body:
                    `This was a ${pct(profile.changePct ?? 0)} move in one session — well beyond ` +
                    `a typical day for ${lower}. Moves this size are usually a reaction to ` +
                    `something specific rather than ordinary drift, so the surrounding news is ` +
                    `worth checking alongside the number.`,
            };
        case 'plunge':
            return {
                heading: 'A sharp single-session fall',
                body:
                    `${metalName} lost ${pct(profile.changePct ?? 0)} in one session, far more ` +
                    `than a normal day's range. Falls this size rarely happen in isolation — ` +
                    `the days on either side give the move its context.`,
            };
        case 'streak':
            return streak
                ? {
                      heading:
                          streak.direction === 'up'
                              ? `${streak.length} sessions higher in a row`
                              : `${streak.length} sessions lower in a row`,
                      body:
                          `This close extended a run of ${streak.length} consecutive sessions ` +
                          `${streak.direction === 'up' ? 'of gains' : 'of losses'}. Runs are more ` +
                          `informative than any one day inside them: they show direction holding ` +
                          `rather than a single session's noise.`,
                  }
                : null;
        case 'reversal':
            return {
                heading: 'A turn against the previous session',
                body:
                    `${metalName} moved the opposite way to the session before it. Single-day ` +
                    `reversals are common and usually mean little on their own — what matters ` +
                    `is whether the next few sessions follow.`,
            };
        case 'quiet':
            return {
                heading: 'A very quiet session',
                body:
                    `${metalName} barely moved, closing within ${pct(profile.changePct ?? 0)} of ` +
                    `the previous session. Flat days are the majority of any price series and ` +
                    `are most useful as the baseline the notable days are measured against.`,
            };
        default:
            return null;
    }
}

/**
 * Secondary context blocks, included only when they say something true and
 * non-obvious. A day that is unremarkable on every axis gets none, and its
 * page is legitimately shorter rather than padded to match.
 */
export function contextBlocks(profile: DayProfile, metalName: string): NarrativeBlock[] {
    const blocks: NarrativeBlock[] = [];
    const lower = metalName.toLowerCase();

    if (profile.isYearHigh && profile.character !== 'record-high') {
        blocks.push({
            heading: 'Highest so far that year',
            body: `At the time, no session earlier in the year had closed higher.`,
        });
    } else if (profile.isMonthHigh) {
        blocks.push({
            heading: 'Highest so far that month',
            body: `No earlier session that month closed above this level.`,
        });
    } else if (profile.isWeekHigh) {
        blocks.push({
            heading: 'Highest so far that week',
            body: `This was the strongest close of the week up to that point.`,
        });
    }

    if (
        profile.belowAllTimeHighPct !== null &&
        profile.belowAllTimeHighPct > 1 &&
        profile.allTimeHighDate &&
        profile.character !== 'record-high'
    ) {
        blocks.push({
            heading: 'Distance from the record',
            body:
                `This close sat ${pct(profile.belowAllTimeHighPct)} below the highest ${lower} ` +
                `close recorded up to that date, set on ${profile.allTimeHighDate}.`,
        });
    }

    if (profile.rankInYear && profile.rankInYear.of >= 20) {
        const { rank, of } = profile.rankInYear;
        // Only worth stating near the extremes; "127th of 250" tells nobody anything.
        if (rank <= 10 || rank > of - 10) {
            blocks.push({
                heading: 'Rank within the year',
                body:
                    rank <= 10
                        ? `One of the ten highest ${lower} closes of that year, ranking ${rank} of ${of} sessions.`
                        : `One of the ten lowest ${lower} closes of that year, ranking ${rank} of ${of} sessions.`,
            });
        }
    }

    return blocks;
}

/**
 * Extra questions specific to the character of the day, appended to the
 * standard set. Returning fewer for ordinary days is deliberate: padding every
 * page to the same question count is what produced identical pages.
 */
export function characterQuestions(
    profile: DayProfile,
    metalName: string
): { question: string; answer: string }[] {
    const lower = metalName.toLowerCase();
    const out: { question: string; answer: string }[] = [];

    if (profile.character === 'record-high' || profile.character === 'record-low') {
        const high = profile.character === 'record-high';
        out.push({
            question: `Was this a record ${lower} price?`,
            answer: high
                ? `Yes. At the time, no earlier session had closed higher. Later sessions may have exceeded it — this page describes the record as it stood on that date, not today's all-time high.`
                : `Yes. No earlier session had closed lower at the time. The series has moved since, so this describes the record as it stood on that date.`,
        });
    }

    if (profile.streak) {
        out.push({
            question: `How many sessions in a row did ${lower} ${profile.streak.direction === 'up' ? 'rise' : 'fall'}?`,
            answer:
                `This close was session ${profile.streak.length} of a consecutive run ` +
                `${profile.streak.direction === 'up' ? 'of gains' : 'of losses'}. A run is counted ` +
                `by closes, so an intraday reversal that still closed in the same direction does ` +
                `not break it.`,
        });
    }

    if (profile.belowAllTimeHighPct !== null && profile.allTimeHighDate) {
        out.push({
            question: `How far below the record was ${lower} on this date?`,
            answer:
                profile.belowAllTimeHighPct < 0.01
                    ? `It was at the record itself — the highest close recorded up to that date.`
                    : `It closed ${pct(profile.belowAllTimeHighPct)} below the highest close on record up to that date, which was set on ${profile.allTimeHighDate}.`,
        });
    }

    if (profile.sessionsSinceHigher !== null && profile.sessionsSinceHigher >= 60) {
        out.push({
            question: `When was ${lower} last higher than this?`,
            answer:
                `The most recent higher close was ${sessionsAsSpan(profile.sessionsSinceHigher)} ` +
                `earlier — ${profile.sessionsSinceHigher} trading sessions before this one.`,
        });
    }

    return out;
}

/** Stable label for the character, used for internal grouping and tests. */
export function characterLabel(character: DayCharacter): string {
    const labels: Record<DayCharacter, string> = {
        'record-high': 'Record high',
        'record-low': 'Record low',
        'high-since': 'Multi-month high',
        'low-since': 'Multi-month low',
        surge: 'Large gain',
        plunge: 'Large fall',
        reversal: 'Reversal',
        streak: 'Streak',
        quiet: 'Quiet session',
        ordinary: 'Ordinary session',
    };
    return labels[character];
}
