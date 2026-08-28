import { hasRangeData } from './conversions';
import type { GoldPriceResponse } from '@/types';

/**
 * Folds a live spot price into the committed snapshot quote.
 *
 * The live source (gold-api.com) returns a price and nothing else — no day
 * range, no previous close, no change. Rather than drop the richer fields when
 * a live tick arrives, the snapshot supplies the reference points and the live
 * price supplies the number:
 *
 *   - change is recomputed against the snapshot's previous close, so the badge
 *     moves with the price instead of freezing at the twice-daily value;
 *   - the day range is widened if the live price has exceeded it, because a
 *     high that the current price is above is visibly wrong.
 *
 * The range is only extended when the snapshot actually had one. When the
 * snapshot itself came from the keyless fallback, high === low === price is a
 * deliberate "we don't know" that PriceCard renders as "unavailable", and
 * stretching that degenerate range around a live price would manufacture a
 * day range out of nothing.
 */
export function mergeLiveQuote(
    base: GoldPriceResponse,
    livePrice: number | null | undefined
): GoldPriceResponse {
    if (typeof livePrice !== 'number' || !Number.isFinite(livePrice) || livePrice <= 0) {
        return base;
    }

    const prevClose = base.prev_close_price;
    const canComputeChange =
        typeof prevClose === 'number' && Number.isFinite(prevClose) && prevClose > 0;

    const ch = canComputeChange ? livePrice - prevClose : base.ch;
    const chp = canComputeChange ? (ch / prevClose) * 100 : base.chp;

    const keepsRange = hasRangeData(base);
    const high = keepsRange ? Math.max(base.high_price, livePrice) : livePrice;
    const low = keepsRange ? Math.min(base.low_price, livePrice) : livePrice;

    const perGram = livePrice / 31.1034768;

    return {
        ...base,
        price: livePrice,
        ch,
        chp,
        high_price: high,
        low_price: low,
        ask: livePrice,
        bid: livePrice,
        price_gram_24k: perGram,
        price_gram_22k: perGram * (22 / 24),
        price_gram_21k: perGram * (21 / 24),
        price_gram_20k: perGram * (20 / 24),
        price_gram_18k: perGram * (18 / 24),
        price_gram_16k: perGram * (16 / 24),
        price_gram_14k: perGram * (14 / 24),
        price_gram_10k: perGram * (10 / 24),
    };
}
