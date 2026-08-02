# ChartGoldPrice

Gold and silver spot prices with historical charts, a karat-aware value
calculator and market news, in eight currencies. Built with Next.js 16 (App
Router), Tailwind CSS v4 and Sanity.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

On a fresh clone `data/prices.json` is empty, so the app falls back to a direct
(cached) API call and the site still works. Run `npm run refresh-data` to
populate it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests for the data pipeline and money maths |
| `npm run refresh-data` | Fetch prices + history and write `data/*.json` |
| `npm run probe-sources` | Check every data source and print a health table |

## How price data works

**Fetching is decoupled from rendering.** This is the important architectural
point and it exists to keep third-party API usage bounded.

```
.github/workflows/refresh-data.yml   (scheduled, 2×/day)
        │
        └─> scripts/refresh-data.mjs ──> GoldAPI + Stooq
                    │
                    └─> commits data/prices.json + data/history.json
                                │
                                └─> src/lib/prices.ts reads the JSON
                                            │
                                            └─> pages render from it
```

The workflow is the only thing that calls the upstream price APIs. Everything
else reads committed JSON, so **upstream usage is a fixed cost per scheduled
run** — it does not scale with traffic, deploys, build workers or serverless
regions.

Measured on this repo:

| | Before | After |
| --- | --- | --- |
| Cold `next build` | 8 upstream calls | **0** |
| 50 concurrent requests to any page | 0–12 | **0** |
| Upstream cost | unbounded | 4 calls/day (~120/month) |

Adjust the cron in `.github/workflows/refresh-data.yml` to match your API plan's
quota. At `0 6,18 * * *` it uses ~120 calls/month.

### Failure behaviour

- A failed fetch **is not cached**, so one bad response cannot blank the site
  for the whole revalidate window.
- A failed refresh **leaves the previous data in place**, so the site keeps
  serving last-known-good values.
- If the historical provider is unreachable, the job still appends that day's
  live quote, so the series keeps growing.

## Verifying data sources

Third-party endpoints often cannot be reached from a sandboxed dev environment,
so **Verify data sources** (`.github/workflows/verify-data-sources.yml`) probes
them from a GitHub runner instead. Run it from the Actions tab any time.

It checks everything currently in use *and* a set of candidate replacements,
then writes a comparison table to the run summary with HTTP status, latency, the
extracted price and a verdict. It never touches `data/`.

The probe is schema-agnostic: it walks arbitrary JSON to find a price field, so
a new provider can be evaluated without writing an adapter first. It also flags
the two classic traps automatically:

- **Inverted quotes** — a source returning XAU-per-USD (≈0.0004) instead of
  USD-per-XAU
- **Per-gram values** presented as per-ounce (off by a factor of 31.1)

Only sources actually in use can fail the run; a dead alternative is reported
but does not go red.

`Refresh price data` also accepts a **dry_run** input, so you can trigger a real
fetch from the Actions tab and inspect the result in the summary without
committing anything.

## Environment variables

All optional — the app runs without any of them.

| Variable | Purpose |
| --- | --- |
| `GOLD_API_KEY` | Overrides the in-source GoldAPI key |
| `SERPAPI_KEY` | Overrides the in-source SerpAPI key |
| `CURRENCY_API_KEY` | Overrides the in-source FreeCurrencyAPI key |
| `NEXT_PUBLIC_GOOGLE_VERIFICATION` | Google Search Console verification token |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager container ID |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project ID |
| `NEXT_PUBLIC_SANITY_DATASET` | Sanity dataset |

> **Note on API keys.** Three keys are currently committed in `src/lib/*-api.ts`
> as a deliberate choice (all free tier). They are in git history, so anyone with
> repository access has them. Set the environment variables above to override
> without a code change, and rotate the keys if the repository is ever made
> public.

### Analytics

GA4 is configured **inside the GTM container**. Do not also add `gtag.js` to the
layout — doing both double-counts every pageview.

## Project layout

```
data/                    Generated price snapshots (do not edit by hand)
scripts/                 Refresh job + unit tests
src/app/                 Routes (App Router)
src/components/          UI components
src/lib/
  prices.ts              Reads snapshots, falls back to live API
  gold-api.ts            Upstream price client (server-only)
  conversions.ts         Weight/karat maths
  currencies.ts          Intl currency formatting (client-safe)
  seo.ts                 Per-page metadata + JSON-LD helpers
  navigation.ts          Nav links, single source of truth
src/sanity/              Blog CMS client and queries
studio-cgp/              Sanity Studio (separate app)
```

## SEO notes

- **Canonicals are per-page.** Never set `alternates.canonical` in
  `src/app/layout.tsx` — the root layout's metadata is inherited by every route,
  so a canonical there points the whole site at one URL. Use `pageMetadata()`
  from `src/lib/seo.ts` instead.
- JSON-LD is page-specific. The FAQ schema belongs on the homepage only;
  breadcrumbs are built per route.
- `sitemap.ts` includes blog posts pulled from Sanity.
- OG images and the favicon are generated at build time from
  `src/app/opengraph-image.tsx` and `src/app/icon.tsx`.

## Testing

```bash
npm test
```

Covers the Stooq CSV parser, history merging, and the weight/karat/ratio maths.
`scripts/conversions.test.mjs` mirrors the TypeScript logic in plain JS — keep
the two in sync when changing `src/lib/conversions.ts`.

## Sanity Studio

```bash
cd studio-cgp
npm install
npm run dev
```

## Disclaimer

Prices are indicative reference values, not live trading quotes. Nothing on the
site is financial advice. See `/terms`.
