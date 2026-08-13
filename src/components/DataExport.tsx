'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import type { HistoryPoint } from '@/types';

/**
 * Downloads the visible series as CSV.
 *
 * Competing chart pages let you look at the data; almost none let you take it.
 * That is a real reason to prefer this page — and the same file is what a
 * researcher, student or spreadsheet user actually wants, which is a kind of
 * demand a price chart alone never captures.
 *
 * Built client-side from data already in the page, so it costs no request and
 * no API quota.
 */
export function DataExport({
    points,
    filename,
    label = 'Download CSV',
}: {
    points: HistoryPoint[];
    filename: string;
    label?: string;
}) {
    const [busy, setBusy] = useState(false);

    if (points.length === 0) return null;

    const download = () => {
        setBusy(true);
        try {
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
            {label}
            <span className="text-xs text-zinc-500">({points.length.toLocaleString('en-US')} rows)</span>
        </button>
    );
}
