# SEO Engineering Playbook

A working reference for agents building and auditing websites. Every rule here
comes from a defect that actually shipped, an audit that actually found
something, or a measurement that turned out to be wrong. It is framework-neutral
except where a section is explicitly labelled otherwise.

**How to use this document.** Do not read it end to end before starting. Use
Part 1 to find the binding constraint, then jump to the parts that address it.
Part 11 (Measurement Discipline) applies to everything and should be read before
you report any number to anyone.

**The governing principle.** SEO defects are overwhelmingly *silent*. A missing
`og:image` does not throw. A soft 404 returns 200. A page absent from your
internal link library still renders perfectly. A metadata helper that quietly
suppresses inherited tags passes every test you have. This means **you cannot
find SEO defects by reading code or running the test suite** — you find them by
measuring the rendered output of a production build and comparing it against
what you believe is true. Build the measurement first.

---

## Table of Contents

1. [Diagnose Before Building](#part-1--diagnose-before-building)
2. [Crawl, Render, Index](#part-2--crawl-render-index)
3. [Metadata](#part-3--metadata)
4. [Structured Data](#part-4--structured-data)
5. [Internationalisation](#part-5--internationalisation)
6. [Content Depth and Programmatic SEO](#part-6--content-depth-and-programmatic-seo)
7. [Internal Linking](#part-7--internal-linking)
8. [Sitemaps](#part-8--sitemaps)
9. [Authority and Off-Page](#part-9--authority-and-off-page)
10. [Answer Engines (AEO)](#part-10--answer-engines-aeo)
11. [Measurement Discipline](#part-11--measurement-discipline)
12. [Data Honesty](#part-12--data-honesty)
13. [Things That Stopped Working](#part-13--things-that-stopped-working)
14. [Appendix A: Framework Traps (Next.js App Router)](#appendix-a--framework-traps-nextjs-app-router)
15. [Appendix B: Reusable Audit Scripts](#appendix-b--reusable-audit-scripts)
16. [Appendix C: Checklists](#appendix-c--checklists)

---

## Part 1 — Diagnose Before Building

### 1.1 Find the binding constraint first

Most SEO work is wasted because it improves something that was not the
bottleneck. Before writing any code, determine which of these is actually
limiting the site:

| Constraint | Symptom | What fixes it |
|---|---|---|
| **Not crawled** | Pages absent from `site:` results; Search Console "Discovered — currently not indexed" | Sitemap, internal links, crawl budget, server speed |
| **Not indexed** | Crawled but "Crawled — currently not indexed" | Content differentiation, page value, duplicate consolidation |
| **Indexed, not ranked** | Impressions at position 50+ | Authority (links), topical depth, intent match |
| **Ranked, no clicks** | Impressions with position 1–10 and ~0 CTR | Title/description, SERP feature stealing the click, zero-click intent |
| **Clicks, no value** | Traffic that does not convert | Intent mismatch — you are ranking for the wrong query |

These require completely different work. Adding content to a site whose problem
is authority does nothing. Building links for a site whose pages are not indexed
does nothing.

### 1.2 How to read a Search Console export

Pull the last 90 days (not 7 — weekly data is too noisy to act on) and compute:

- **Queries with impressions > 100 and clicks = 0.** Either the position is too
  low, or the intent is answered in the SERP itself. Check the position column
  before assuming it is a title problem.
- **Average position by page template.** If one template averages 50+ across
  hundreds of URLs, that template has a systemic problem, not a per-page one.
- **Pages with impressions but zero queries listed.** Usually means the page is
  ranking only for long-tail variants below the reporting threshold — a sign of
  thin or undifferentiated content.
- **The gap between impression-weighted position and click-weighted position.**
  A large gap means you are getting impressions on queries you cannot win.

### 1.3 Establish the baseline before you change anything

Run the full audit (Appendix B) and save the output. Without a before, you have
no after. This is not optional bookkeeping — it is the only way to distinguish
"my change worked" from "the crawl happened to update".

---

## Part 2 — Crawl, Render, Index

### 2.1 Soft 404s are the most common silent defect

A **soft 404** is a URL that returns HTTP 200 with "not found" content. Search
Console reports them, they consume crawl budget, and bots generate them
constantly by probing paths like `/wp-admin`, `/charts/wordpress`,
`/.env`.

The failure mode in modern frameworks: a dynamic route calls its
`notFound()` equivalent *inside the component*, which renders the not-found
**body** but the response status has already been committed as 200.

**Rule.** For any dynamic route whose valid parameter set is **closed and
known** (a fixed list of metals, currencies, units, categories, product slugs),
tell the router to serve only the pre-generated set and 404 everything else at
the routing layer.

- Next.js App Router: `export const dynamicParams = false;`
- Nuxt / others: validate in middleware and throw a real 404 before render.

**Do not do this** where the valid set is large, open, or grows between builds
(thousands of dated archive URLs, user-generated slugs). There, the correct
answer is an explicit status-setting 404, not param freezing.

**Verification (must be done — this cannot be reasoned about):**

```bash
for p in /charts/notametal /category/notacategory /product/notaproduct; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")  $p"
done
# Every line must read 404. Then check a VALID slug still returns 200.
```

Always test a valid sibling in the same run. Tightening a route until it 404s
everything is a regression that looks like a fix.

### 2.2 Freezing a parameter set has a maintenance cost

If you freeze params at build time, a newly valid value is **not served until
the next deploy**. This is fine when:

- the set is genuinely closed, or
- the same build that adds the value also redeploys the site (e.g. a data
  refresh job that commits, triggering CI).

Write the reasoning into the code as a comment. The next person to add a
category will otherwise spend an hour on a mysterious 404.

### 2.3 Streaming and RSC break naive HTML scraping

Modern frameworks stream page content as serialised component payloads. The
**first HTML flush may contain only the layout shell.** Content arrives in later
chunks and is patched in.

**Consequence:** a regex over `curl` output can report *zero links, zero words,
zero headings* on a page that renders perfectly. This is a measurement artefact,
not a finding.

**Rule.** Measure the **rendered DOM** with a headless browser for anything
involving content, links, or headings. Raw HTTP is fine only for status codes
and `<head>` tags that are emitted in the first flush.

If you ever get a suspiciously uniform result (every page has zero links), your
instrument is broken. Check the instrument before reporting the finding.

### 2.4 Canonicals

- Every indexable page declares a **self-referencing absolute canonical**.
- Parameterised variants (`?sort=`, `?page=2`, tracking params) canonicalise to
  the clean URL — *except* paginated series, where page 2 should self-canonical.
- Never canonicalise a page to a *different* page unless it is a genuine
  duplicate. Cross-canonicalising near-duplicates to a "main" page deindexes
  them; if that is what you want, say so explicitly.
- Canonical, sitemap URL, internal link href, and the actual served URL must
  agree byte for byte on protocol, subdomain, trailing slash, and case. Any
  disagreement splits signals.

### 2.5 Robots and crawl control

- `robots.txt` disallow **prevents crawling, not indexing**. A disallowed URL
  can still appear in results from links alone, with no snippet. To deindex, use
  `noindex` and *allow* crawling so the directive can be seen.
- Never both disallow and `noindex` the same URL. The crawler cannot read the
  `noindex` it is forbidden from fetching.
- Do not block CSS or JS. Rendering-based indexing needs them.

---

## Part 3 — Metadata

### 3.1 Length budgets

| Element | Budget | Truncation reality |
|---|---|---|
| `<title>` | ~60 characters | Actually ~600px — capital letters and wide glyphs truncate sooner |
| `meta description` | ~155 characters | Google rewrites it ~70% of the time anyway |

**Measure the keyword portion separately from the brand suffix.** A 67-character
title of the form `Coin Melt Value Calculator — Junk Silver & Bullion | BrandName`
is *fine*: the 17-character brand suffix is what truncates, and every keyword is
visible. Reporting it as a defect wastes effort and makes titles worse.

```js
const SUFFIX = ' | BrandName';
const keyword = title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : title;
// Flag only when keyword.length > 60.
```

### 3.2 Descriptions are for click-through, not ranking

Meta descriptions are not a ranking factor. Write them to earn the click:
lead with the specific thing the page has that the others do not, include a
concrete number or differentiator, and put the strongest clause first because
the tail truncates.

### 3.3 The metadata-helper trap (high severity, very common)

**If you have a shared `pageMetadata()` helper, audit what it silently
suppresses.**

Frameworks commonly auto-inject metadata (an Open Graph image from a
convention-based file, for instance) **only for routes that do not declare that
object themselves**. A helper that always declares `openGraph` therefore
suppresses the auto-injection on *every page that uses the helper* — which is
usually every page except the one that does not use it.

Real instance: a site had a generated OG image and `twitter:card:
summary_large_image` on every page, promising an image that was never emitted
anywhere except the homepage. Every link shared to Slack, WhatsApp, Reddit or X
rendered as a grey box. Nothing errored. No test failed. It survived multiple
reviews because the code looked correct.

**Rule.** A shared metadata helper must declare every field it takes ownership
of, explicitly. Never rely on inheritance you have partially overridden.

**Verification:**

```js
// Across one URL per template:
const og = html.match(/property="og:image"\s+content="([^"]+)"/);
// Must be present on every single one.
```

### 3.4 Open Graph completeness

Declare all of: `og:title`, `og:description`, `og:url`, `og:site_name`,
`og:type`, `og:locale`, `og:image` (absolute URL), `og:image:width`,
`og:image:height`, `og:image:alt`. Then `twitter:card`, `twitter:title`,
`twitter:description`, `twitter:image`.

Width and height matter: without them some scrapers refuse to render the large
card and fall back to the small one.

---

## Part 4 — Structured Data

### 4.1 What to emit

| Type | Use for | Still yields rich results? |
|---|---|---|
| `Organization` + `WebSite` | Site-wide, once, in the root layout | Sitelinks searchbox, knowledge panel signals |
| `BreadcrumbList` | Every page below the root | **Yes** — visible breadcrumb in SERP |
| `Product` + `Offer` | Commerce | **Yes** |
| `Article` / `NewsArticle` | Editorial | **Yes** |
| `Dataset` | Any page publishing structured data | Yes, in Google Dataset Search |
| `WebApplication` | Calculators, converters, tools | Indirect |
| `WebAPI` | Public API documentation | Indirect |
| `FAQPage` | Q&A blocks | **No** — see Part 13 |
| `HowTo` | Step-by-step | **No** — deprecated |

`FAQPage` and `HowTo` no longer produce rich results for general sites. Keep
emitting `FAQPage` — it is well-formed entity data that answer engines parse —
but do **not** justify the work by promising rich snippets.

### 4.2 Rules

- **Schema must describe what is visibly on the page.** Marking up an FAQ that
  users cannot see is a spam violation.
- **Validate the JSON.** A duplicate key in a JSON-LD object literal silently
  discards the earlier value — the last one wins, and no parser warns you.
- Emit one `<script type="application/ld+json">` per schema, or a single array.
  Both work; be consistent.
- Prefer `@id` cross-references to repeating the same `Organization` object.
- Run every template through the Rich Results Test and the Schema.org validator
  once. They catch different things.

### 4.3 Publishing an OpenAPI spec

If the site has a public API, ship an OpenAPI document at a stable path.

**Use OpenAPI 3.0.x, not 3.1**, unless you have a specific reason. Many
directories, validators and ingestion tools still do not handle 3.1's JSON
Schema alignment. 3.0.3 is the maximally compatible choice.

Pair it with `WebAPI` schema on the human-readable docs page. This combination
is what API directories ingest, and API directories are one of the few
legitimate, high-authority, topically-relevant link sources that still exist.

---

## Part 5 — Internationalisation

### 5.1 hreflang correctness

- **Reciprocity is mandatory.** If A declares B, B must declare A. One-way
  declarations are ignored entirely.
- Every page in a cluster lists **every** member, **including itself**.
- Include exactly one `x-default`, pointing at the fallback for unmatched users.
- Use absolute URLs. Use valid ISO codes (`en-GB`, not `en-UK`; `uk` is
  Ukrainian, not United Kingdom — a genuinely common and costly mix-up).
- Every hreflang target must return 200 and be indexable. Pointing at a
  redirecting or `noindex` URL voids the cluster.

### 5.2 Regional variants are not translations

Two pages in the *same language* targeting *different regions* — a dollar page
and a sterling page, both English — are a legitimate hreflang cluster
(`en` / `en-GB` / `x-default`). Without the cluster declared, they compete for
one intent and search engines pick one, usually the wrong one.

Keep this mechanism separate from your translation system in code. They look
similar and behave differently; conflating them produces clusters that mix
languages and regions incorrectly.

### 5.3 The camelCase trap

React and several other frameworks emit the attribute as `hrefLang` in the
HTML source, not `hreflang`. **A case-sensitive grep for `hreflang` returns
nothing on a page where the tags are present and correct.**

This produced a false "the fix did not work" conclusion in a real audit. Always
grep case-insensitively, or parse the DOM.

---

## Part 6 — Content Depth and Programmatic SEO

### 6.1 "Short" is not the problem — undifferentiated is

Word count is not a ranking factor. A 300-word page that completely answers a
narrow query outranks a 2,000-word page that pads. The real questions are:

1. Does the page answer the query **completely**, so the user does not go back?
2. Does it contain something **no other page has** — proprietary data, a
   computed figure, a tool, a specific measurement?
3. Would a knowledgeable person find it worth reading?

If the honest answer to (2) is no, adding words will not help. Add *substance*:
a computed table, a comparison, a record, a calculation, an interactive tool.

### 6.2 The subtraction test for programmatic pages

This is the single most useful diagnostic for pSEO at scale.

**Method.** Render N pages of the same template. Strip the shared chrome
(header, footer, nav). Tokenise the remaining main content into overlapping
word shingles. Compute pairwise Jaccard similarity. Report the **median**.

```
median similarity  >  90%   Google will index a handful and ignore the rest
                80–90%      marginal; the tail will not be indexed
                <  80%      each page is carrying real independent content
```

Implementation in Appendix B.5.

**Calibrate before you trust the absolute number.** The score depends on the
shingle size `K` and on document length, and it is not intuitive. With `K = 6`,
a single substituted word destroys six shingles — so on a *short* page one
changed number can drop similarity by 60 points, while on a 600-word page ten
changed numbers move it only to ~0.82. The thresholds above assume `K = 6` over
main content of at least 300 words.

Because of that, **treat the metric as relative, not absolute**. Measure the
same template before and after your change with identical settings. A 10-point
drop is real progress; the third decimal place is not. One real site moved from
~95% to 82.9% median, and that *delta* was the meaningful result.

### 6.3 How to actually reduce similarity

Adding a sentence with a different number in it does not work — shingle
similarity barely moves. What works:

**Multiple templates chosen by data.** Classify each page by what its data
actually shows, then render a structurally different page per class. For a
dated price archive, classes might be: record high, record low, largest gain,
largest loss, reversal, quiet consolidation, gap, streak continuation, range
break, unremarkable. Each class gets its own headline structure, its own
emphasised statistics, its own narrative order.

This moved one real site from ~95% to 82.9% median similarity.

**Computed narrative, not filler.** Generate prose from the data:
*"the highest close since 14 March 2011"*, *"the third consecutive weekly
decline"*, *"a 3.2% move, larger than 98% of sessions on record"*. These
sentences differ between pages because the underlying facts differ. Template
filler with a variable substituted does not.

**Genuinely unique elements per page.** Neighbouring-period navigation, records
relevant only to this page, per-page computed comparisons.

### 6.4 Rules for programmatic pages

- **Never publish a page for a combination with no data.** An empty state at
  scale is a scaled-content-abuse signal.
- **Roll out in bands, not all at once.** Publish the segment with proven
  demand, measure indexation, then widen. Dumping 12,000 URLs on a low-authority
  domain gets most of them classified as low value, and that judgement is sticky.
- **Gate on evidence.** Use search data to pick which segments to publish, not
  the assumption that more URLs is better.
- Make the publication rule a **single exported, tested function**, not a
  condition buried in a sitemap loop. It decides what the world sees; it
  deserves a test.

---

## Part 7 — Internal Linking

### 7.1 Measure inbound, in-content links

Two rules that change everything about what you measure:

1. **Exclude header, footer and sidebar links.** They appear on every page, so
   including them gives every page an identical score and hides the real
   structure. Count only links inside the main content region.
2. **Inbound matters more than outbound.** A page's internal authority comes
   from how many other pages' body copy points at it.

### 7.2 The link-library pattern, and its failure mode

A good pattern: a central registry mapping a key to `{ href, label, description }`,
with pages selecting entries by key.

```js
export const LINK_LIBRARY = {
  goldToday: { href: '/gold-price-today', label: "Today's gold price",
               description: 'Spot price per ounce, gram and kilogram.' },
  // ...
};
export function relatedLinks(...keys) { return keys.map(k => LINK_LIBRARY[k]); }
```

Benefits: consistent descriptive anchor text, no duplicated copy, one place to
audit.

**The failure mode: a page missing from the library cannot be linked from any
other page's body copy.** Pages shipped after the library was written get
forgotten. On one real site this left four pages with exactly **one** in-content
inbound link each while the most-linked page had 46 — a 46:1 spread caused
entirely by omission, not by design.

**Guard it with a test that reads both sides from the repository:**

```js
// Extract hrefs from the library source; enumerate routes from the app
// directory; assert every route (minus an explicit exemption list) appears.
// Adding a page without a library entry then fails CI.
```

Do not mirror the library's contents in the test — that only asserts a copy
matches the original. Read the *routes* from the filesystem. That is external
truth.

### 7.3 Rebalancing

- Aim for a spread no worse than roughly **10:1** between the most- and
  least-linked important pages.
- Rebalance by *swapping* keys on already-linked pages, not by appending links
  everywhere. Blocks of 4–8 contextual links are fine; 30 is a link farm.
- Link topically. A related-links block should make sense to a human.
- Use descriptive anchor text. Never "click here" or a bare URL.
- **Cross-link siblings.** Two pages covering parallel topics should link to
  each other. This is the most commonly missed link on any site.

### 7.4 Orphan detection

Any indexable page with zero in-content inbound links is functionally orphaned,
even if it is in the sitemap and the nav. Run the link-graph script (Appendix B)
and treat every zero as a defect.

---

## Part 8 — Sitemaps

### 8.1 Accuracy over completeness

- **`lastmod` must be the date the content actually changed.** Setting it to
  `now` on every regeneration destroys its only purpose — telling crawlers what
  to re-fetch. If you cannot compute a real modification date, omit the field.
- **`changefreq` and `priority` are largely ignored by Google.** Keep them
  honest but do not spend time tuning them.
- Only include URLs that return **200**, are **indexable**, and are
  **self-canonical**. A sitemap full of redirects, 404s or canonicalised-away
  URLs degrades trust in the whole file.
- Split at 50,000 URLs / 50MB uncompressed into a sitemap index.

### 8.2 The listing rule must match the linking reality

This is a subtle, high-value check almost nobody runs.

If you deliberately limit which URLs appear in the sitemap, **verify that your
internal linking honours the same limit**. A common outcome: a sitemap
deliberately publishes a bounded subset while a component elsewhere links to the
entire unbounded set. The pages are then crawled anyway, just without `lastmod`
or `priority`. You withheld the signal, not the crawl — the worst of both.

Resolve it in one of two directions, deliberately:

- **Widen the sitemap** to include what you link — correct when the linked pages
  are the *valuable* ones (records, milestones, high-demand segments).
- **Narrow the linking** to match the sitemap — correct when the links are
  incidental.

Sequential navigation (previous/next) is a legitimate exception: it will always
reach unlisted neighbours, and closing that gap would mean listing everything.
Document it as intentional rather than pretending closure.

### 8.3 Check nothing in the sitemap 404s

Especially after tightening routes (Part 2.1). The failure mode is trading a
soft-404 problem for a hard-404-in-sitemap problem, which is worse.

```js
// Sample one URL per route shape, plus EVERY url under any route you changed.
```

---

## Part 9 — Authority and Off-Page

### 9.1 Evaluating a backlink profile

Two numbers, always together:

- **Backlinks (BL)** — raw link count. Nearly meaningless alone.
- **Referring domains (DP / RD)** — distinct linking sites. This is the signal.

**The ratio is a spam detector.** 217,000 backlinks from **2** referring domains
is one site-wide footer link repeated — one vote, not 217,000. Anything above
roughly 1,000 links per referring domain is site-wide boilerplate or a scraper
network.

Cross-check with an independent authority index (Majestic Million rank, or
equivalent). A domain with genuine six-figure backlinks and no presence in a
top-million index is contradicting itself.

### 9.2 Expired domains: do not

Buying a dropped domain for its backlinks and redirecting it is **expired domain
abuse**, written explicitly into Google's spam policies in March 2024 alongside
scaled content abuse and site reputation abuse. It is not a grey area.

Even ignoring policy, it does not work:

- Keyword-matching a domain list matches the *string*, not the *topic*. A search
  for "gold" returns sneaker-replica outlets ("Golden Goose"), game-currency
  farms ("WoW gold"), and unrelated businesses with the word in their name.
- Link equity requires topical relevance. Links from replica-sneaker spam to a
  finance site pass nothing.
- If the site already has a spam-link problem, adding more compounds the exact
  thing holding it back.

### 9.3 What actually builds authority

Ranked by effort-to-value for a technical site:

1. **Free API or open dataset.** Publish real data, keyless, CORS-enabled,
   documented, with an OpenAPI spec. Then *submit it* — building the asset and
   never distributing it is the most common failure.
   - `public-apis/public-apis` on GitHub and its forks
   - APIs.guru (ingests OpenAPI specs directly)
   - RapidAPI Hub, APIList.fun, FreePublicAPIs, ProgrammableWeb successors
   - Language-specific awesome-lists
2. **A genuinely useful free tool** that other sites will reference.
3. **Original data or research** others cite — the only reliable way to earn
   editorial links.
4. **Being the canonical answer** to a definitional question in your niche.

All four produce *editorial* links from *topically relevant* sources. That is
the category that moves authority. Nothing else reliably does.

---

## Part 10 — Answer Engines (AEO)

Assume a growing share of queries are answered without a click. Optimise to be
the **cited source** rather than only the clicked result.

### 10.1 What answer engines can actually use

- **A direct answer in the first paragraph**, then elaboration. Inverted pyramid.
- **Specific, checkable facts with attribution**: figures, dates, units, sources.
  "Gold reached $5,318.40 on 29 January 2026" is citable. "Gold has performed
  strongly" is not.
- **Comparison and summary tables.** Structured, extractable, unambiguous.
- **Entity-rich content.** Name the organisations, standards, places, units and
  regulations relevant to the topic. Entity density is how a model establishes
  that a page is about a subject.
- **Stated methodology.** How the number was computed, over what period, from
  what source. Models and humans both weight this.
- **Explicit measured uncertainty.** See 10.3.

### 10.2 Practical mechanics

- Answer the question in the `<h2>` and the sentence beneath it.
- One question per heading; phrase headings as the question a user types.
- Keep `FAQPage` schema even without rich results — it is clean entity data.
- Consider `/llms.txt` (a plain-text index of your key pages, per the
  llmstxt.org convention). It is unproven and adoption by major crawlers is not
  confirmed, but it is ~30 minutes of work and costs nothing. Do not oversell it.
- Make sure your content is *in the HTML* — see Part 2.3.

### 10.3 Publish measured accuracy, not confident claims

Counter-intuitive and high-value.

If you publish a prediction, forecast, estimate or score, **publish its measured
accuracy against a naive benchmark**. For a time series, the benchmark is
"assume no change"; compute skill ratio = model error / naive error, via
rolling-origin backtest.

If the honest answer is "our forecast is no more accurate than assuming the
price will not change" — **publish that sentence**. It reads as weakness and is
in fact the differentiator: it is a checkable fact a model can cite, in a
category where every competitor emits unfalsifiable confidence.

Contrast with what the competition does: a real forecast page quoted a
next-week range of `$4,254.97–$5,052.87` — a ±9% band, stated to the cent — and
a monthly forecast already contradicted by the spot price printed on the same
page. Precision theatre is trivially detectable and worth nothing.

---

## Part 11 — Measurement Discipline

**Read this part before reporting any number.** Every rule below comes from a
real wrong measurement.

### 11.1 Suspiciously clean results mean a broken instrument

- **Byte-identical results across three separate builds is not possible.** If
  you see it, you are measuring a stale artefact. (Real cause: a `sed` intended
  to repoint a probe at the new port never ran because the compound command was
  killed before reaching it. Three "measurements" all hit an old server.)
- **Every page scoring exactly zero** on a metric means the extractor is broken,
  not that the site has none. (Real cause: regex over streamed HTML — Part 2.3.)
- **A uniform value across heterogeneous pages** is an instrument artefact until
  proven otherwise.

### 11.2 Shell traps that silently invalidate runs

```bash
pkill -f "next start" && npm start   # ✗ pkill kills the shell running it;
                                     #   `&&` never fires. Worse, pkill's
                                     #   pattern can match its own command line.
```

```bash
pkill -f server; sleep 1; npm start  # ✗ still risky — verify the port is free
```

```bash
# ✓ Kill by PID, verify, then start, then verify the start succeeded.
ps -eo pid,cmd | grep '[n]ext-server' | awk '{print $1}' | xargs -r kill -9
sleep 2
nohup npm start > server.log 2>&1 &
sleep 5
cat server.log          # EADDRINUSE here means you measured the OLD build
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:$PORT/
```

**`EADDRINUSE` is the dangerous one**: the new server dies, the old one keeps
serving, every subsequent measurement is of the previous build, and nothing in
your test output says so. Always read the server log after starting.

Also: heredocs inside a command that gets killed never write their file. Verify
the file exists before assuming it does.

### 11.3 Case sensitivity and encoding

- Grep case-insensitively for HTML attributes (`hrefLang` vs `hreflang`).
- Chunked/streamed responses have **no `content-length`**. A probe reporting
  "0 KB" for a real payload is measuring a missing header, not a small file.
- HTML entities change string lengths. `&amp;` is 5 characters in source and 1
  on screen — a title measured from source reads longer than the DOM's.

### 11.4 Negative controls

**Every guard test must be proven to fail.** After writing a test that asserts
"every route has a link-library entry", delete an entry and confirm it fails,
then restore. A guard that has never failed may be asserting nothing.

Apply the same to audits: before trusting "0 soft 404s", introduce a bad URL and
confirm the probe catches it.

### 11.5 Assert against external truth

Tests that re-implement the logic and compare to itself prove nothing. Instead:

- Compare a binary search against a brute-force linear scan.
- Compare a computed metric against an independent calculation by a different
  method (anchor-based YTD vs filter-based YTD).
- Compare against **hand-computed values**: 100 → 150 is +50%.
- Compare against a **third party**. Cross-checking a performance table against
  a major finance site validated the whole computation: 6-month −13.82% vs
  their −14.03%, 10-year 241.1% vs 237.0%, with the residual explained by
  futures vs spot — and the record-high *date* matching exactly.
- Compare against **published reference values** for standard algorithms
  (Wilder's original RSI worked example, etc.). Expect small deviations from
  rounded published inputs; widen the tolerance with a documented reason rather
  than changing the algorithm to match.

### 11.6 When a fixture and the code disagree

Determine which is wrong before changing either. In one real case a test fixture
asserted that a tied value counted as a new record; the *code* was wrong and the
fixture encoded the bug. Fixing the code then exposed a second fixture with the
same mistake.

Write down the rule ("a tie is not a record — the record belongs to the session
that first set it"), then make code and fixtures both obey it.

---

## Part 12 — Data Honesty

Every rule here is also an SEO rule: fabricated precision is detectable,
E-E-A-T-damaging, and increasingly the thing that decides whether an answer
engine cites you.

### 12.1 Never render a provider's placeholder as a fact

Real defect: a quote API returned `prev_close_price` equal to `price` with
`change` and `change_percent` both `0` for metals it had no history for.
Rendering that field directly displayed **"0.00%" on a day the metal moved
7.9%** — asserting the market was flat.

**Rule.** Distinguish *zero* from *unknown*. A provider's default value is not
data. Detect the placeholder shape, fall back to a source you trust, and render
a dash when neither can answer. A genuine zero must still display as zero.

### 12.2 Describe your coverage accurately

Do not write "25 years of daily prices" when you hold 768 points, mostly
monthly. Compute the description from the data:

- Determine the first date from which coverage is genuinely *dense* (e.g. ≥100
  points/year, prorated for partial boundary years — a naive gap-walk breaks
  the moment there is one isolated hole).
- Label full-range figures with the real start year: **"Since 2000"**, not
  **"All time"**. They are not the same thing and the difference can be a
  century.
- Re-run this check after any data backfill. A coverage description that was
  true before a backfill can silently become wrong after it.

### 12.3 Show the anchor

When a figure is computed against a reference point that might not be exact —
a "1 year" return anchored to the nearest available close in a gappy series —
**display the date actually used**. Refuse the row entirely if the drift exceeds
a defined tolerance that scales with the horizon.

This turns "trust me" into "check me", which is the entire game with both
readers and answer engines.

### 12.4 Keep comments true

A code comment describing behaviour that was never implemented is worse than no
comment: it stops the next reader from noticing the gap. One real codebase
documented a `noindex, follow` rule for low-value pages that existed nowhere in
the source. Correct the comment to describe what the code does, and raise the
gap separately rather than silently implementing it.

---

## Part 13 — Things That Stopped Working

Do not spend effort on these, and do not let anyone justify work with them:

| Tactic | Status |
|---|---|
| `FAQPage` rich results | Restricted (Aug 2023) to authoritative government and health sites. Schema still useful for entity data; no visible SERP feature. |
| `HowTo` rich results | Deprecated for desktop and mobile. |
| Keyword density / meta keywords | Dead for decades. `<meta name="keywords">` is ignored. |
| Exact-match domains | Neutralised long ago. A brandable domain is worth more. |
| Expired-domain redirects | Explicit spam policy (March 2024). |
| Article spinning, scaled AI content | Scaled content abuse (March 2024). |
| `changefreq` / `priority` tuning | Largely ignored. |
| Word-count targets | Never was a factor. |
| Link exchanges, paid link networks, PBNs | Link spam policy; increasingly well-detected. |

---

## Appendix A — Framework Traps (Next.js App Router)

Skip this appendix if you are not using Next.js. The *pattern* of each trap
generalises even where the API does not.

1. **`dynamicParams = false`** turns unknown params into real routing-layer
   404s. Without it, `notFound()` renders the not-found body with a 200 status.
2. **Route segment config cannot be re-exported.** `export { dynamicParams }
   from './shared'` silently does nothing. Declare `export const dynamicParams
   = false;` literally in every route file.
3. **One dynamic slug per path level.** `app/[locale]` and `app/[category]` as
   siblings is a build error. Use explicit routes calling a shared renderer.
4. **File-convention `opengraph-image` is suppressed** on any route whose
   metadata declares `openGraph`. See Part 3.3 — this is the highest-severity
   silent defect in this appendix.
5. **`hrefLang`, not `hreflang`**, in the emitted HTML. See Part 5.3.
6. **`generateStaticParams` runs at build time only.** ISR revalidation does not
   re-run it, so with `dynamicParams = false` a newly valid param 404s until the
   next deploy.
7. **Client components force a subtree client-side.** Keep interactivity in
   small leaf components so the surrounding content stays server-rendered and
   present in the initial payload. A live-updating price should be a leaf, not
   a wrapper around the page.
8. **A server-rendered timestamp inside a static parent will not update** even
   when a sibling client component ticks. If a value must move with live data,
   it has to live inside the client boundary.
9. **`cache()`-wrapped data readers** deduplicate per request — an async server
   component can fetch what it needs without the parent threading props through.

---

## Appendix B — Reusable Audit Scripts

All scripts assume a **production build** running locally (`BASE`). Development
builds have different metadata, different bundling, and no static generation —
never audit one.

### B.1 Per-template page audit

```js
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3000';
const SUFFIX = ' | BrandName';           // adjust
const PAGES = [                          // ONE representative URL per template
  ['home', '/'], ['product', '/product/example'], ['category', '/category/example'],
];

const b = await chromium.launch();
const p = await b.newPage();
const rows = [];

for (const [name, path] of PAGES) {
  await p.goto(BASE + path, { waitUntil: 'load' });
  await p.waitForTimeout(1000);                 // let streamed content settle

  const main  = await p.locator('main').first().innerText().catch(() => '');
  const title = await p.title();
  const desc  = (await p.locator('meta[name="description"]')
                   .getAttribute('content').catch(() => '')) ?? '';
  const html  = await p.content();

  rows.push({
    name, path,
    words:   main.split(/\s+/).filter(Boolean).length,
    h1:      await p.locator('main h1').count(),
    h2:      await p.locator('main h2').count(),
    links:   await p.locator('main a').count(),
    title:   title.length,
    keyword: (title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : title).length,
    desc:    desc.length,
    og:      /property="og:image"/i.test(html),
    canon:   await p.locator('link[rel="canonical"]').count(),
    schema:  [...new Set((await p.locator('script[type="application/ld+json"]')
                .allTextContents())
                .flatMap(s => { try { const j = JSON.parse(s);
                    return (Array.isArray(j) ? j : [j]).map(o => o['@type']); }
                  catch { return []; } }))],
  });
}
console.table(rows);

console.log('\n--- issues ---');
for (const r of rows) {
  const bad = [];
  if (r.h1 !== 1)        bad.push(`${r.h1} H1 tags`);
  if (r.keyword > 60)    bad.push(`title keyword part ${r.keyword} chars`);
  if (r.desc > 160)      bad.push(`description ${r.desc} chars`);
  if (r.desc === 0)      bad.push('no meta description');
  if (!r.og)             bad.push('NO og:image');
  if (r.canon !== 1)     bad.push(`${r.canon} canonical tags`);
  if (r.schema.length===0) bad.push('no structured data');
  if (bad.length) console.log(`  ${r.path}: ${bad.join('; ')}`);
}
await b.close();
```

### B.2 Soft-404 probe

```bash
BASE=http://localhost:3000
# Invalid slugs must be 404; valid siblings must stay 200.
for p in /product/notaproduct /category/notacategory /tag/notatag \
         /product/real-product /category/real-category; do
  printf '%s  %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")" "$p"
done
```

### B.3 Internal link graph (in-content only)

```js
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3000';

const xml  = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(m => m[1].replace(/^https?:\/\/[^/]+/, '') || '/');

const b = await chromium.launch();
const p = await b.newPage();
const outbound = new Map(), inbound = new Map();

for (const path of urls.slice(0, 200)) {            // sample large sites
  await p.goto(BASE + path, { waitUntil: 'load' });
  const hrefs = await p.$$eval('main a[href]',
    as => as.map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/')));
  const set = new Set(hrefs.map(h => h.replace(/\/$/, '') || '/'));
  set.delete(path);
  outbound.set(path, set);
  for (const t of set) {
    if (!inbound.has(t)) inbound.set(t, new Set());
    inbound.get(t).add(path);
  }
}
await b.close();

const scored = [...outbound.keys()]
  .map(u => ({ u, in: inbound.get(u)?.size ?? 0, out: outbound.get(u).size }))
  .sort((a, z) => a.in - z.in);

console.log('inbound in-content links (header/footer excluded)');
for (const { u, in: i, out } of scored) {
  console.log(`  in=${String(i).padStart(3)} out=${String(out).padStart(3)}  ${u}` +
              (i === 0 ? '   <-- ORPHAN' : i <= 2 ? '   <-- thin' : ''));
}
const max = Math.max(...scored.map(s => s.in));
const min = Math.min(...scored.filter(s => s.in > 0).map(s => s.in));
console.log(`\nspread ${max}:${min} (aim for 10:1 or better)`);
```

### B.4 Sitemap integrity

```js
const BASE = process.env.BASE || 'http://localhost:3000';
const xml  = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(m => m[1].replace(/^https?:\/\/[^/]+/, '') || '/');
console.log(`sitemap lists ${urls.length} URLs`);

// One sample per shape, plus EVERY url under routes you changed this session.
const CHANGED_PREFIXES = ['/product/', '/category/'];
const shape = u => u.replace(/\/[^/]*\d[^/]*/g, '/N');
const sample = new Map();
for (const u of urls) if (!sample.has(shape(u))) sample.set(shape(u), u);
const check = [...new Set([
  ...urls.filter(u => CHANGED_PREFIXES.some(p => u.startsWith(p))),
  ...sample.values(),
])];

let bad = 0;
for (const u of check) {
  const r = await fetch(BASE + u, { redirect: 'manual' });
  if (r.status !== 200) { console.log(`  ${r.status}  ${u}`); bad++; }
}
console.log(bad === 0 ? `OK — all ${check.length} sampled URLs return 200`
                      : `${bad} sitemap URLs do not return 200`);
```

### B.5 pSEO similarity (the subtraction test)

```js
import { chromium } from 'playwright';
const BASE  = process.env.BASE || 'http://localhost:3000';
const PAGES = process.argv.slice(2);          // 15-30 URLs of ONE template
const K = 6;                                  // shingle size in words

const shingles = (text) => {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + K <= w.length; i++) s.add(w.slice(i, i + K).join(' '));
  return s;
};
const jaccard = (a, b) => {
  let hit = 0;
  for (const x of a) if (b.has(x)) hit++;
  return hit / (a.size + b.size - hit);
};

const b = await chromium.launch();
const p = await b.newPage();
const docs = [];
for (const path of PAGES) {
  await p.goto(BASE + path, { waitUntil: 'load' });
  await p.waitForTimeout(800);
  const s = shingles(await p.locator('main').first().innerText());
  // A page with fewer than K words yields an empty set, and jaccard would
  // return 0/0 = NaN, silently poisoning the median. Drop and report it.
  if (s.size === 0) { console.warn(`  skipped (too short to shingle): ${path}`); continue; }
  docs.push(s);
}
await b.close();
if (docs.length < 2) { console.error('need at least 2 usable pages'); process.exit(1); }

const sims = [];
for (let i = 0; i < docs.length; i++)
  for (let j = i + 1; j < docs.length; j++) sims.push(jaccard(docs[i], docs[j]));
sims.sort((x, y) => x - y);

const pct = n => (n * 100).toFixed(1) + '%';
console.log(`pairs        ${sims.length}`);
console.log(`median       ${pct(sims[Math.floor(sims.length / 2)])}`);
console.log(`p90          ${pct(sims[Math.floor(sims.length * 0.9)])}`);
console.log(`max          ${pct(sims[sims.length - 1])}`);
console.log(sims[Math.floor(sims.length / 2)] > 0.9
  ? '\n>90%: only a handful of these will be indexed.'
  : sims[Math.floor(sims.length / 2)] > 0.8
  ? '\n80-90%: marginal — the tail will struggle.'
  : '\n<80%: each page carries real independent content.');
```

---

## Appendix C — Checklists

### C.1 Before shipping any new page template

- [ ] Exactly one `<h1>`, logical `h2`/`h3` hierarchy
- [ ] Self-referencing absolute canonical
- [ ] `og:image` **verified present in the rendered HTML** (Part 3.3)
- [ ] Title keyword portion ≤ 60 chars, description ≤ 155
- [ ] Structured data present and validated
- [ ] Added to the internal link library (Part 7.2)
- [ ] Linked from at least 3 other pages' body copy
- [ ] Added to the sitemap — **verify it is actually there**
- [ ] Invalid params return 404, valid ones return 200
- [ ] If programmatic: similarity measured and below 85%
- [ ] Renders correctly with JavaScript disabled, or content is in the initial HTML

### C.2 Before claiming an SEO fix works

- [ ] Measured on a **production build**, not dev
- [ ] Server confirmed to be the **new** build (checked the log for `EADDRINUSE`)
- [ ] Measured the **rendered DOM**, not raw HTML, for content and links
- [ ] Case-insensitive matching for HTML attributes
- [ ] Results differ from the baseline in a plausible, explainable way
- [ ] Any guard test proven to fail when the defect is reintroduced
- [ ] Cross-checked against an independent method or third party where possible
- [ ] No sitemap URL started 404ing as a side effect

### C.3 Quarterly site audit

- [ ] Run B.1 across every template; diff against last quarter
- [ ] Run B.2 with fresh invalid slugs
- [ ] Run B.3; fix every orphan, check the spread
- [ ] Run B.4 in full, not sampled
- [ ] Run B.5 on the largest programmatic template
- [ ] Search Console: coverage errors, soft 404s, "crawled — not indexed" trend
- [ ] Backlink profile: BL/RD ratio, new toxic domains
- [ ] Re-verify every data-coverage claim in prose against the actual data
- [ ] Check every code comment describing SEO behaviour still matches the code

---

## One-Page Summary

1. **Find the binding constraint before building anything.** Crawl, index, rank
   and click are four different problems with four different fixes.
2. **SEO defects are silent.** Measure rendered output of production builds;
   never infer from code.
3. **Soft 404s are the most common technical defect.** 200-with-not-found-body.
4. **Audit what your metadata helper suppresses.** Partial overrides of
   framework-injected metadata are invisible and site-wide.
5. **Short is fine; undifferentiated is not.** Measure similarity, not length.
6. **A page nothing links to does not exist.** Measure in-content inbound links.
7. **Your sitemap rule and your linking must agree**, in one direction or the
   other, deliberately.
8. **Referring domains, not backlinks.** The ratio between them detects spam.
9. **Never buy expired domains for links.** Named spam policy, and it does not
   work anyway.
10. **Publish measured uncertainty.** It is a citable fact where competitors
    have only unfalsifiable confidence.
11. **Distinguish zero from unknown.** Never render a provider's placeholder as
    a fact.
12. **Prove your guards fail.** A test that has never failed may assert nothing.
