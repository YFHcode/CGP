'use client';

import { useEffect, useState } from 'react';

import type { HistoryPoint } from '@/types';

/**
 * The full daily record, fetched only when a chart needs it.
 *
 * Range charts ship the last RECENT_POINTS closes in the page (see
 * src/lib/chart-window.ts). That covers 1W through 1Y exactly, and 1M is the
 * default view, so most visitors never need more. 5Y, 10Y and MAX do, and ask
 * for it here.
 *
 * The source is /api/data rather than the page payload for cost reasons: the
 * route is dynamic and CDN-cached, so it never touches the ISR store, and a
 * visitor who clicks MAX pays ~70 KB of gzipped JSON once instead of every
 * visitor paying 300 KB on every page.
 */

export type HistoryMetal = 'gold' | 'silver' | 'platinum' | 'palladium';

export type FullHistoryStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * One request per metal per page view, however many charts ask for it — the
 * homepage's explorer and a price chart below it share the gold record.
 */
const requests = new Map<HistoryMetal, Promise<HistoryPoint[]>>();

export function loadFullHistory(metal: HistoryMetal): Promise<HistoryPoint[]> {
    const pending = requests.get(metal);
    if (pending) return pending;

    const request = fetch(`/api/data?history=${metal}`)
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((body) => {
            const points = body?.history?.[metal];
            if (!Array.isArray(points)) throw new Error(`no ${metal} history in the response`);
            return points as HistoryPoint[];
        });

    // A failed request must not be cached for the rest of the visit, or one
    // dropped connection would pin every long range to the fallback.
    request.catch(() => requests.delete(metal));
    requests.set(metal, request);
    return request;
}

/**
 * The full record for `metal` once it has been asked for.
 *
 * `wanted` starts the request; after that the record is kept, so switching
 * back to 1M and out to MAX again does not refetch. `points` is null until it
 * arrives — callers fall back to the recent tail they already hold.
 *
 * A `metal` of undefined means the chart already has everything (an archive
 * page's own period, say) and nothing is ever fetched.
 */
export function useFullHistory(
    metal: HistoryMetal | undefined,
    wanted: boolean
): { points: HistoryPoint[] | null; status: FullHistoryStatus } {
    const [loaded, setLoaded] = useState<{ metal: HistoryMetal; points: HistoryPoint[] } | null>(null);
    const [failedFor, setFailedFor] = useState<HistoryMetal | null>(null);

    const have = loaded !== null && loaded.metal === metal;

    useEffect(() => {
        if (!metal || !wanted || have) return;

        let live = true;
        loadFullHistory(metal).then(
            (points) => {
                if (!live) return;
                setLoaded({ metal, points });
                setFailedFor(null);
            },
            () => {
                if (live) setFailedFor(metal);
            }
        );
        return () => {
            live = false;
        };
    }, [metal, wanted, have]);

    if (!metal) return { points: null, status: 'idle' };
    if (have) return { points: loaded.points, status: 'ready' };
    if (failedFor === metal) return { points: null, status: 'failed' };
    return { points: null, status: wanted ? 'loading' : 'idle' };
}
