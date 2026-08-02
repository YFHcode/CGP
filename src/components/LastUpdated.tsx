import { Clock } from 'lucide-react';

interface LastUpdatedProps {
    /** ISO timestamp of the last data refresh. */
    updatedAt: string | null;
    className?: string;
}

/**
 * Shows when the price data was last refreshed.
 *
 * A price site has to state the age of its data. The site previously claimed
 * "live" and "real-time" while serving values cached for eight hours, with no
 * timestamp shown anywhere.
 */
export function LastUpdated({ updatedAt, className }: LastUpdatedProps) {
    if (!updatedAt) return null;

    const date = new Date(updatedAt);
    if (!Number.isFinite(date.getTime())) return null;

    return (
        <p className={className ?? 'flex items-center justify-center gap-1.5 text-xs text-zinc-400'}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
                Prices last updated{' '}
                <time dateTime={updatedAt}>
                    {date.toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'UTC',
                    })}{' '}
                    UTC
                </time>
            </span>
        </p>
    );
}
