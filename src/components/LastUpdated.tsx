import { Clock } from 'lucide-react';

interface LastUpdatedProps {
    /** ISO timestamp of the last committed data refresh. */
    updatedAt: string | null;
    /**
     * The live quote's own timestamp, when live polling is landing. Takes
     * precedence over updatedAt for the headline figure.
     */
    liveAt?: string | null;
    className?: string;
}

function formatUtc(iso: string, withSeconds = false) {
    return (
        new Date(iso).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: withSeconds ? 'medium' : 'short',
            timeZone: 'UTC',
        }) + ' UTC'
    );
}

/**
 * Shows when the price data was last refreshed.
 *
 * A price site has to state the age of its data. The site previously claimed
 * "live" and "real-time" while serving values cached for eight hours, with no
 * timestamp shown anywhere.
 *
 * Once the ticker landed, this label had the opposite problem: it kept
 * reporting the twice-daily snapshot time while the price above it updated
 * every fifteen seconds, so it understated freshness by hours. When a live
 * quote is present its timestamp is the honest answer for the headline price
 * — but the day range and the change are still measured against the snapshot,
 * so that provenance is stated on its own line rather than silently dropped.
 */
export function LastUpdated({ updatedAt, liveAt, className }: LastUpdatedProps) {
    const liveDate = liveAt ? new Date(liveAt) : null;
    const isLive = Boolean(liveDate && Number.isFinite(liveDate.getTime()));

    if (!isLive && !updatedAt) return null;
    if (!isLive && updatedAt && !Number.isFinite(new Date(updatedAt).getTime())) return null;

    const wrapper = className ?? 'flex flex-col items-center gap-1 text-xs text-zinc-400';

    if (isLive && liveAt) {
        return (
            <div className={wrapper}>
                <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                        Price quoted{' '}
                        <time dateTime={liveAt}>{formatUtc(liveAt, true)}</time>
                    </span>
                </p>
                {updatedAt && Number.isFinite(new Date(updatedAt).getTime()) && (
                    <p className="text-zinc-500">
                        Day range and change measured from the{' '}
                        <time dateTime={updatedAt}>{formatUtc(updatedAt)}</time> snapshot
                    </p>
                )}
            </div>
        );
    }

    return (
        <p className={className ?? 'flex items-center justify-center gap-1.5 text-xs text-zinc-400'}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
                Prices last updated{' '}
                <time dateTime={updatedAt!}>{formatUtc(updatedAt!)}</time>
            </span>
        </p>
    );
}
