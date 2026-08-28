'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isMetalsMarketOpen, marketClosedReason } from '@/lib/market-hours';

/**
 * Polls /api/live and hands back the latest spot prices.
 *
 * Three things it deliberately does not do:
 *
 *   - poll a closed market. Metals trade Sunday evening to Friday evening ET;
 *     between those the number cannot change, so asking again is a promise of
 *     liveness the data can't keep.
 *   - poll a hidden tab. A background tab left open overnight would otherwise
 *     make thousands of pointless requests.
 *   - retry forever. After repeated failures it gives up and the UI falls back
 *     to the server-rendered snapshot price, which is still a real price.
 *
 * The interval is longer than the "every 10 seconds" instinct on purpose: the
 * upstream provider asks callers to cache for 30s, so a faster poll would
 * return the same number it already had, spending the visitor's battery and
 * data to re-render an identical value.
 */

const POLL_MS = 15_000;
const MAX_CONSECUTIVE_FAILURES = 4;

export interface LiveQuote {
    price: number;
    updatedAt: string | null;
}

export interface LivePricesState {
    gold: LiveQuote | null;
    silver: LiveQuote | null;
    /** True once at least one successful poll has landed. */
    live: boolean;
    marketOpen: boolean;
    closedReason: string | null;
    /** True when polling has stopped after repeated failures. */
    stalled: boolean;
}

interface LiveResponse {
    ok?: boolean;
    marketOpen?: boolean;
    marketClosedReason?: string | null;
    gold?: LiveQuote | null;
    silver?: LiveQuote | null;
}

export function useLivePrices(enabled = true): LivePricesState {
    const [state, setState] = useState<LivePricesState>(() => ({
        gold: null,
        silver: null,
        live: false,
        // Computed on the client after mount, so the first render matches the
        // server's and hydration stays clean.
        marketOpen: true,
        closedReason: null,
        stalled: false,
    }));

    const failures = useRef(0);
    const stopped = useRef(false);

    const poll = useCallback(async () => {
        if (stopped.current) return;

        // Cheap local check first: no point asking the server whether the
        // market is open when the clock already answers it.
        if (!isMetalsMarketOpen()) {
            setState((s) => ({
                ...s,
                marketOpen: false,
                closedReason: marketClosedReason(),
            }));
            return;
        }

        try {
            const res = await fetch('/api/live', { cache: 'no-store' });
            if (!res.ok) throw new Error(`live: ${res.status}`);
            const data: LiveResponse = await res.json();
            if (stopped.current) return;

            if (!data.ok) throw new Error('live: upstream unavailable');

            failures.current = 0;
            setState({
                gold: data.gold ?? null,
                silver: data.silver ?? null,
                live: true,
                marketOpen: data.marketOpen ?? true,
                closedReason: data.marketClosedReason ?? null,
                stalled: false,
            });
        } catch {
            failures.current += 1;
            if (failures.current >= MAX_CONSECUTIVE_FAILURES) {
                stopped.current = true;
                setState((s) => ({ ...s, live: false, stalled: true }));
            }
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        let timer: ReturnType<typeof setInterval> | null = null;

        const start = () => {
            if (timer !== null || stopped.current) return;
            void poll();
            timer = setInterval(() => void poll(), POLL_MS);
        };

        const stop = () => {
            if (timer !== null) {
                clearInterval(timer);
                timer = null;
            }
        };

        const onVisibility = () => {
            if (document.hidden) stop();
            else start();
        };

        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled, poll]);

    return state;
}
