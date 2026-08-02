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

export type MetalSymbol = 'XAU' | 'XAG';

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
  metals: Partial<Record<MetalSymbol, GoldPriceResponse>>;
}

/** Shape of `data/history.json`. */
export interface HistorySnapshot {
  updatedAt: string | null;
  /** Where the series came from, for attribution in the UI. */
  source: string | null;
  series: Partial<Record<MetalSymbol, HistoryPoint[]>>;
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
