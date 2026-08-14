import Image from 'next/image';
import type { NewsItem } from '@/types';

interface NewsCardProps {
    item: NewsItem;
    /** Larger image on the dedicated news page. */
    imageHeight?: number;
    priority?: boolean;
}

export function NewsCard({ item, imageHeight = 176, priority = false }: NewsCardProps) {
    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 transition-all hover:border-gold-500/30 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
            {item.thumbnail && (
                <div className="relative w-full overflow-hidden" style={{ height: imageHeight }}>
                    <Image
                        src={item.thumbnail}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        className="object-cover transition-transform group-hover:scale-105"
                        priority={priority}
                        // Third-party thumbnails occasionally 404; failing soft
                        // beats a broken-image icon inside the card.
                        unoptimized
                    />
                </div>
            )}
            <div className="p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-gold-400">{item.source}</span>
                    <span className="shrink-0 text-xs text-zinc-400">{item.date}</span>
                </div>
                <h3 className="mb-2 line-clamp-2 text-lg font-bold text-white transition-colors group-hover:text-gold-300">
                    {item.title}
                </h3>
                {/* Archive-backed items carry link metadata only — no snippet
                    is stored, by design — so render nothing rather than an
                    empty paragraph that leaves a ragged gap in the card. */}
                {item.snippet && (
                    <p className="line-clamp-3 text-sm text-zinc-300">{item.snippet}</p>
                )}
            </div>
        </a>
    );
}
