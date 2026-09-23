'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import { loadFullHistory, type HistoryMetal } from '@/lib/use-full-history';

/**
 * Downloads a metal's full daily record as CSV.
 *
 * Competing chart pages let you look at the data; almost none let you take it.
 * That is a real reason to prefer this page — and the same file is what a
 * researcher, student or spreadsheet user actually wants, which is a kind of
 * demand a price chart alone never captures.
 *
 * The record is fetched when the button is pressed, not carried in the page.
 * It used to be embedded so the download cost no request — which meant every
 * visitor to /charts/gold paid for 6,500 rows that almost none of them would
 * ever download, on a page already billed per 8 KB. The same shared request
 * serves the charts' MAX view, so a visitor who has looked at the full record
 * downloads it without a second fetch.
 */
export function DataExport({
    metal,
    rows,
    filename,
    label = 'Download CSV',
}: {
    metal: HistoryMetal;
    /** Shown on the button, so the size is known before anything is fetched. */
    rows: number;
    filename: string;
    label?: string;
}) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    if (rows === 0) return null;

    const download = async () => {
        setBusy(true);
        setFailed(false);
        try {
            const points = await loadFullHistory(metal);
            const header = 'date,close_usd\n';
            const body = points.map((p) => `${p.date},${p.close}`).join('\n');
            const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            onClick={download}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-gold-500/30 hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:opacity-60"
        >
            <Download className="h-4 w-4" aria-hidden="true" />
            {failed ? 'Download failed — try again' : label}
            <span className="text-xs text-zinc-500">({rows.toLocaleString('en-US')} rows)</span>
        </button>
    );
}
