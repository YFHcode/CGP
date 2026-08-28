export interface GoldPriceResponse {
  timestamp: number;
  metal: string;
  currency: string;
  exchange: string;
  symbol: string;
  prev_close_price: number;
  open_price: number;
  low_price: number;
  high_price: number;
  open_time: number;
  price: number;
  ch: number;
  chp: number;
  ask: number;
  bid: number;
  price_gram_24k: number;
  price_gram_22k: number;
  price_gram_21k: number;
  price_gram_20k: number;
  price_gram_18k: number;
  price_gram_16k: number;
  price_gram_14k: number;
  price_gram_10k: number;
}

/**
 * Gold and silver, deliberately kept as their own type.
 *
 * A great deal of the site's logic is specific to these two — karat purity,
 * the gold-to-silver ratio, scrap and melt values, junk silver. Widening this
 * union to cover platinum and palladium would make all of that typecheck
 * against metals it is meaningless for (there is no "22K platinum"), so the
 * newer metals get their own symbol type and their own pages instead.
 */
export type MetalSymbol = 'XAU' | 'XAG';

/** Platinum and palladium: same feed, different story, no karat system. */
export type MinorMetalSymbol = 'XPT' | 'XPD';

/** Anything the price snapshot may hold. */
export type AnyMetalSymbol = MetalSymbol | MinorMetalSymbol;

/** A single day of historical closing data. */
export interface HistoryPoint {
  /** ISO date, YYYY-MM-DD */
  date: string;
  close: number;
}

/**
 * Shape of `data/prices.json`, written by scripts/refresh-data.mjs and read at
 * build/request time. The app never calls the upstream price API directly while
 * this file is populated.
 */
export interface PriceSnapshot {
  /** ISO timestamp of the last successful refresh, or null if never run. */
  updatedAt: string | null;
  metals: Partial<Record<AnyMetalSymbol, GoldPriceResponse>>;
}

/** Shape of `data/history.json`. */
export interface HistorySnapshot {
  updatedAt: string | null;
  /** Where the series came from, for attribution in the UI. */
  source: string | null;
  series: Partial<Record<AnyMetalSymbol, HistoryPoint[]>>;
}

/** News item returned by the news provider. Shared by server and client code. */
export interface NewsItem {
  position?: number;
  link: string;
  title: string;
  source: string;
  date: string;
  published_at?: string;
  snippet: string;
  thumbnail?: string;
}
