import { getPrices, getHistory } from '@/lib/prices';
import { SITE_URL } from '@/lib/navigation';
import { describeCoverage } from '@/lib/coverage';
import { GRAMS_PER_OZ } from '@/lib/conversions';
import { slugForKey } from '@/lib/history-periods';
import { buildLlmsTxt, type ArchiveExamples } from '@/lib/llms-txt';

/**
 * llms.txt — a plain-text summary for AI assistants and answer engines.
 *
 * A large share of this site's search impressions come from machine-generated
 * queries ("current gold spot price usd per troy ounce august 10 2026" and
 * hundreds of near-identical variants), which rank well but never click,
 * because an assistant reads rather than browses. This file gives those
 * readers the current figures, the licence terms and a pointer to the JSON
 * API in one cheap fetch, so the site is easy to cite correctly rather than
 * paraphrased from a stale snippet.
 *
 * Emerging convention (llmstxt.org), not a standard — it costs one small
 * route and is ignored harmlessly by anything that doesn't look for it.
 */

// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

/**
 * A real archive URL per granularity, derived from the newest close we hold so
 * the examples stay fetchable as the archive grows.
 */
function archiveExamples(base: string, latestDate: string | null): ArchiveExamples | null {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(latestDate ?? '');
    if (!match) return null;

    const [, year, month] = match;
    return {
        year: `${SITE_URL}${base}/${year}`,
        month: `${SITE_URL}${base}/${slugForKey(`${year}-${month}`, 'month')}`,
        day: `${SITE_URL}${base}/${slugForKey(latestDate!, 'day')}`,
    };
}

export async function GET() {
    const [{ gold, silver, updatedAt }, history] = await Promise.all([getPrices(), getHistory()]);

    const facts = describeCoverage(history.gold);
    const latestDate = history.gold.at(-1)?.date ?? null;

    const body = buildLlmsTxt({
        siteUrl: SITE_URL,
        goldPrice: gold?.price ?? null,
        silverPrice: silver?.price ?? null,
        perGram: (ozPrice: number) => (ozPrice / GRAMS_PER_OZ).toFixed(2),
        updatedAt: updatedAt ?? null,
        firstDate: history.gold[0]?.date ?? null,
        coverage: facts ? facts.sentence : 'unavailable',
        source: history.source ?? null,
        points: history.gold.length,
        goldArchive: archiveExamples('/gold-price', latestDate),
        silverArchive: archiveExamples('/silver-price', latestDate),
    });

    return new Response(body, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
        },
    });
}
