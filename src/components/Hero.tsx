import { PriceCard } from './PriceCard';
import { LastUpdated } from './LastUpdated';
import { cn } from '@/lib/utils';
import type { GoldPriceResponse, MetalSymbol } from '@/types';

interface HeroProps {
    goldData: GoldPriceResponse | null;
    silverData: GoldPriceResponse | null;
    updatedAt?: string | null;
    heading?: React.ReactNode;
    subheading?: string;
    /** Render the heading as h1 (default) or h2 when the page already has one. */
    as?: 'h1' | 'h2';
    /**
     * Show only this metal's card. Omit for the dual-card dashboard view
     * (the homepage) — the gold/silver "today" pages pass their own metal so
     * they read as a specialized page rather than a comparison view.
     */
    metal?: MetalSymbol;
}

/**
 * Price cards with an optional heading.
 *
 * Data is always passed in by the page. The previous version fetched its own
 * data when either value was missing, which meant a single failed metal
 * triggered a redundant second fetch of both.
 */
export function Hero({
    goldData,
    silverData,
    updatedAt,
    heading,
    subheading,
    as: Heading = 'h1',
    metal,
}: HeroProps) {
    return (
        <section className="relative overflow-hidden py-12 md:py-20">
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-3xl -translate-x-1/2 opacity-30">
                <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-b from-gold-500/10 to-transparent blur-3xl" />
            </div>

            <div className="container relative z-10 mx-auto px-4">
                {heading && (
                    <div className="mb-12 text-center">
                        <Heading className="mb-4 text-4xl font-bold tracking-tight text-white md:text-6xl">
                            {heading}
                        </Heading>
                        {subheading && (
                            <p className="mx-auto max-w-2xl text-lg text-zinc-300">{subheading}</p>
                        )}
                    </div>
                )}

                <div
                    className={cn(
                        'mx-auto grid grid-cols-1 gap-6',
                        metal ? 'max-w-md' : 'max-w-4xl md:grid-cols-2'
                    )}
                >
                    {(!metal || metal === 'XAU') && (
                        <PriceCard symbol="XAU" name="Gold" data={goldData} />
                    )}
                    {(!metal || metal === 'XAG') && (
                        <PriceCard symbol="XAG" name="Silver" data={silverData} />
                    )}
                </div>

                <div className="mt-6">
                    <LastUpdated updatedAt={updatedAt ?? null} />
                </div>
            </div>
        </section>
    );
}
