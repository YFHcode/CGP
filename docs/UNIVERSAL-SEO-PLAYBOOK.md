# Universal SEO Playbook

**For AI agents that build, audit and grow websites — any stack, any site type.**

Version 2.0 · September 2026. Dated facts are marked with their date. Search
changes quickly: before acting on anything dated, check the primary source
(Google Search Central, Bing Webmaster Guidelines, web.dev, the crawler
owner's own documentation). Secondary SEO blogs repeat errors — in 2026 several
confidently reported that the "good" LCP threshold had dropped to 2.0 s; web.dev
still says 2.5 s.

Every rule here comes from a defect that shipped, an audit that found something,
or a measurement that turned out to be wrong. The scripts in Appendix B were run
against a real production site and against deliberately broken inputs before
being written down.

---

## How to use this document

**Do not load all of it.** Load what the task needs:

| Task | Read |
|---|---|
| Any task | [Part 0](#part-0--operating-rules-for-the-agent) and the [one-page summary](#one-page-summary) |
| Building a new site | Parts 1–6, 9–11, your site type in [Part 19](#part-19--site-type-modules), [D.1](#d1-pre-launch) |
| Auditing an existing site | Parts 1, 4, 16, your site type, Appendix B, [D.5](#d5-monthly-health-check) |
| Adding a new page type or template | Parts 3, 6, 8, 9, 10, [C.3](#c3-page-template-spec), [D.2](#d2-new-page-template) |
| Pages not indexed | [18.1](#181-a-page-is-not-indexed), [16.3](#163-the-page-indexing-report-decoded) |
| Traffic dropped | [18.2](#182-traffic-dropped) |
| Migration, redesign or domain change | [Part 17](#part-17--launches-migrations-and-redesigns), [D.7](#d7-migration) |
| Hosting bill or usage alert | [Part 15](#part-15--bots-crawl-cost-and-hosting) |
| Being cited by AI assistants | [Part 14](#part-14--ai-search-and-answer-engines) |
| Reporting numbers to anyone | [Part 16](#part-16--measurement-and-diagnosis) first |

**The governing principle.** SEO defects are almost always *silent*. A missing
social image does not throw. A soft 404 returns 200. A page nothing links to
still renders perfectly. A metadata helper that suppresses inherited tags passes
every unit test. You will not find these by reading code or running the test
suite. You find them by measuring the rendered output of a production build and
comparing it with what you believe is true. Build the measurement first.

---

## Table of contents

- [Part 0 — Operating rules for the agent](#part-0--operating-rules-for-the-agent)
- [Part 1 — Intake: understand the site first](#part-1--intake-understand-the-site-first)
- [Part 2 — Demand, intent and what is winnable](#part-2--demand-intent-and-what-is-winnable)
- [Part 3 — Information architecture and URLs](#part-3--information-architecture-and-urls)
- [Part 4 — Crawling, rendering and indexing](#part-4--crawling-rendering-and-indexing)
- [Part 5 — Discovery: sitemaps, IndexNow, feeds](#part-5--discovery-sitemaps-indexnow-feeds)
- [Part 6 — On-page elements](#part-6--on-page-elements)
- [Part 7 — Content quality](#part-7--content-quality)
- [Part 8 — Templated and programmatic pages at scale](#part-8--templated-and-programmatic-pages-at-scale)
- [Part 9 — Structured data](#part-9--structured-data)
- [Part 10 — Internal linking](#part-10--internal-linking)
- [Part 11 — Performance, page experience and page weight](#part-11--performance-page-experience-and-page-weight)
- [Part 12 — International and multilingual](#part-12--international-and-multilingual)
- [Part 13 — Authority and off-page](#part-13--authority-and-off-page)
- [Part 14 — AI search and answer engines](#part-14--ai-search-and-answer-engines)
- [Part 15 — Bots, crawl cost and hosting](#part-15--bots-crawl-cost-and-hosting)
- [Part 16 — Measurement and diagnosis](#part-16--measurement-and-diagnosis)
- [Part 17 — Launches, migrations and redesigns](#part-17--launches-migrations-and-redesigns)
- [Part 18 — Troubleshooting playbooks](#part-18--troubleshooting-playbooks)
- [Part 19 — Site-type modules](#part-19--site-type-modules)
- [Part 20 — Things that stopped working, and myths](#part-20--things-that-stopped-working-and-myths)
- [Appendix A — Rendering modes and framework traps](#appendix-a--rendering-modes-and-framework-traps)
- [Appendix B — Audit toolkit](#appendix-b--audit-toolkit)
- [Appendix C — Templates](#appendix-c--templates)
- [Appendix D — Checklists](#appendix-d--checklists)
- [One-page summary](#one-page-summary)

---

## Part 0 — Operating rules for the agent

These apply to every task. They exist because each was broken at least once,
with consequences.

### 0.1 Verify, never infer

- Measure the **rendered output of a production build**. Development builds
  differ in metadata, bundling and static generation.
- For content, links and headings, measure the **rendered DOM** (headless
  browser). Raw HTML is reliable only for status codes, headers and tags that
  arrive in the first bytes. Streaming frameworks send a layout shell first and
  the content later; a regex over `curl` output can report zero links on a page
  full of them.
- A **suspiciously uniform result** (every page scores zero, three builds are
  byte-identical) means the instrument is broken. Check the instrument before
  reporting the finding.
- After starting a server, **read its log**. An `EADDRINUSE` means the old
  server is still answering and every measurement is of the previous build.

### 0.2 Prove the check can fail

- Every guard, test or audit gets a **negative control**: introduce the defect
  on purpose, confirm the check catches it, then restore. A check that has never
  failed may be asserting nothing.
- **Assert against external truth**, not against a re-implementation of the same
  logic: documented reference values, hand-computed numbers, a third-party
  source, a brute-force method. The robots.txt tester in Appendix B is tested
  against the examples in Google's own documentation, not against itself.
- When a test fixture and the code disagree, decide which one is wrong *before*
  changing either. Fixtures encode bugs too.

### 0.3 Ask for what you cannot see

You usually cannot access these. Ask the human early, and say exactly what to export:

| Data | Where the human gets it | What it answers |
|---|---|---|
| Search performance | Search Console → Performance → Export (28 days *and* 3 months) | What ranks, what gets clicked, trends |
| Indexing status | Search Console → Pages (click each reason for example URLs) | Why pages are not indexed |
| Bing performance and AI citations | Bing Webmaster Tools → Search Performance, AI Performance | Bing/Copilot visibility |
| Traffic and conversions | Analytics tool, landing-page report | Which organic traffic has value |
| Hosting usage | Host dashboard: usage, per-route breakdown, bot breakdown | Cost drivers, bot share |
| Server or CDN logs | Host or CDN log export | What crawlers actually request |
| Business context | The human | Goals, audience, markets, constraints, what converts |

Never present a guess about data you have not seen as a finding. Say what you
would need to know and why.

### 0.4 Report honestly

- Separate **verified** (measured, with the command) from **inferred**.
- Correct your own earlier statements plainly when they turn out wrong, once,
  without drama — the human is making decisions on them.
- Do not claim causality from a before/after without equal windows and an
  explanation for seasonality, algorithm updates and data events (Part 16.5).
- Report the bad news as clearly as the good. "This will not get you under the
  free tier on its own" is more useful than an optimistic summary.

### 0.5 Change safely

- Small, reversible changes. When you need to attribute an effect, change one
  thing at a time and log it with a date (Appendix C.5).
- Every change to routing, redirects, canonicals, robots or sitemaps gets a
  before/after run of the relevant audit script. These are the changes that
  silently remove pages from search.
- Tightening something (routes that now 404, stricter robots rules) is a
  regression that looks like a fix until you test a **valid sibling** in the same
  run.
- Formatters and code generators can rewrite whole files. Review the diff, not
  your intent.

### 0.6 Never fabricate

No invented data, reviews, ratings, authors, credentials, dates, "updated"
stamps, or structured data describing content the user cannot see. Beyond being
wrong, each of these is a spam-policy violation or an E-E-A-T liability, and
answer engines increasingly decide what to cite by checkability.

### 0.7 Cost is part of SEO

Rendering mode, page weight, prefetching, revalidation timers, deploy frequency
and crawler access all have hosting costs. A change that is correct for search
can quietly multiply a bill. Part 15 covers this; consider it before shipping
anything that changes how many pages exist, how large they are, or how often
they are regenerated.

### 0.8 Solve the binding constraint

Find what actually limits the site (Part 1.3) before building anything. Most
wasted SEO effort improves something that was not the bottleneck.

---

## Part 1 — Intake: understand the site first

### 1.1 The intake questions

Answer these before proposing work. The full copy-paste questionnaire is in
[C.1](#c1-intake-questionnaire).

1. **What is the business model?** What does a valuable visit do — buy, sign
   up, call, read ads, subscribe, donate?
2. **Who searches, for what, where?** Audience, countries, languages, devices.
3. **What type of site is it?** Use 1.2. Many sites are hybrids; pick the
   module for each section.
4. **Where does traffic come from today?** Organic, direct, referral, social,
   AI assistants — and for organic, which page types.
5. **How strong is the domain?** Referring domains, brand searches, age of
   content. This sets what is winnable (2.3).
6. **What is the stack?** Framework, rendering mode (SSR, SSG, ISR, CSR),
   hosting, CMS, who can change what.
7. **What are the constraints?** Regulated topic, legal review, budget, hosting
   plan limits, release process.
8. **What access exists?** Search Console, Bing Webmaster Tools, analytics,
   logs, hosting dashboard, repository.
9. **Is it YMYL?** "Your Money or Your Life": finance, health, legal, safety,
   civic information. These get more scrutiny; evidence of expertise and
   accuracy matters more (7.2).

### 1.2 Classify the site

| Site type | What usually ranks | Primary intent | Biggest risk | Module |
|---|---|---|---|---|
| E-commerce | Category pages, product pages | Buy, compare | Faceted-navigation URL explosion, duplicate products | [19.1](#191-e-commerce) |
| SaaS / B2B software | Feature, use-case, comparison, integration, docs pages | Evaluate, solve a problem | Marketing site rendered client-side; thin programmatic pages | [19.2](#192-saas-and-b2b-software) |
| Content publisher, blog, affiliate | Articles, guides, reviews | Learn, decide | Unoriginal content, thin affiliate pages | [19.3](#193-content-publishers-blogs-and-affiliate-sites) |
| News publisher | Articles, topic hubs | Know what happened now | Crawl speed, freshness, duplication across syndication | [19.4](#194-news-publishers) |
| Local or multi-location business | Business profile, location pages, service pages | Find nearby, call, visit | Doorway location pages, inconsistent business data | [19.5](#195-local-and-multi-location-businesses) |
| Marketplace, directory, listings, jobs | Listing pages, category × location pages | Find a specific offer | Expired or empty listings at scale, index bloat | [19.6](#196-marketplaces-directories-and-listings) |
| Data, tools, programmatic | Tool pages, data pages per entity or date | Look up, calculate | Near-duplicate templates, page weight, AI answers taking the click | [19.7](#197-data-tools-and-programmatic-sites) |
| Documentation, developer portal | Reference, guides, error-message pages | Solve a specific technical problem | Version duplication, client-side rendering | [19.8](#198-documentation-and-developer-portals) |
| Web app or SPA with a public surface | Marketing pages, public shared pages | Evaluate, sign up | Nothing in the HTML, soft 404s everywhere | [19.9](#199-web-apps-and-single-page-applications) |
| Community, forum, UGC | Threads, Q&A, profiles | Real experiences, answers | Spam, thin profiles, moderation at scale | [19.10](#1910-communities-forums-and-ugc) |
| Portfolio, brand, small business | Home, about, services, case studies | Find or check a specific person/company | Too few pages to target anything; weak brand SERP | [19.11](#1911-portfolios-personal-brands-and-small-business-sites) |

### 1.3 Find the binding constraint

Five problems that look alike from outside and need completely different work:

| Constraint | Symptom | What fixes it |
|---|---|---|
| **Not crawled** | Search Console "Discovered – currently not indexed"; pages missing from logs | Internal links, sitemaps, server speed, crawl-budget waste (4.8) |
| **Not indexed** | "Crawled – currently not indexed"; duplicates | Page value, differentiation, consolidation, demand (7, 8) |
| **Indexed, not ranking** | Impressions at position 30+ | Authority, topical depth, intent match (2, 13) |
| **Ranking, not clicked** | Position 1–10, CTR near zero | Title/snippet, SERP features and AI answers taking the click, wrong intent (6, 14) |
| **Clicked, no value** | Traffic that never converts | Intent mismatch — you rank for the wrong queries (2) |

**The authority ceiling.** A new or weak domain will not rank for competitive
head terms whatever its on-page quality. At that stage the winnable work is:
long-tail queries with specific intent, assets nobody else has (original data,
tools, local presence, first-hand expertise), and earning links (Part 13). Adding
more pages to a site whose constraint is authority adds more pages that do not
rank.

### 1.4 Capture a baseline before changing anything

Save, with dates:

- Search Console: 3-month Performance export, Pages report counts per reason.
- The Appendix B audits: page audit per template, sitemap audit, link graph,
  page weight, hreflang (if relevant), status probe.
- Hosting usage figures (Part 15) and Core Web Vitals field data.
- A list of what is about to change and when (Appendix C.5).

Without a before there is no after — only "the crawl happened to update".

---

## Part 2 — Demand, intent and what is winnable

### 2.1 Find demand without paid tools

| Source | What it gives you |
|---|---|
| Search Console queries | What you already rank for; queries at positions 8–20 are the cheapest wins |
| Search autocomplete and "People also ask" | How people actually phrase the problem |
| The results page itself | The format Google thinks satisfies the intent (2.2) |
| Bing Webmaster Tools keyword research | Volume estimates, free |
| Competitors' sitemaps and navigation | The page types that exist in the niche |
| Forums, Reddit, Q&A sites, reviews | Problems, objections, vocabulary |
| Your internal site search logs | Demand you already have and fail to serve |
| Support tickets and sales calls | High-intent questions no one has written up |

Paid tools add volume estimates and competitor data. They do not replace
looking at the actual results page for a query.

### 2.2 Match the intent and the format

Classify every target query:

- **Know** (information), **do** (a task or tool), **buy** (commercial or
  transactional), **go** (a specific site or brand), **visit** (local).

Then look at what ranks. The results page is the specification: if the top
results are calculators, an article will not win; if they are category grids, a
blog post will not win; if a local pack dominates, the business profile matters
more than the website. **Match the format, not just the words.**

### 2.3 Decide what is winnable

For each target query, check:

1. **Who ranks.** Major brands, government, Wikipedia and marketplaces on a
   head term usually mean a weak domain cannot compete there yet.
2. **What takes the click.** AI Overviews, featured snippets, knowledge panels,
   calculators and data answers built into the results page. A query answered
   by one number is mostly zero-click: ranking first earns an impression and a
   citation, rarely a visit.
3. **What you can offer that the ranking pages do not.** Original data, a
   better tool, first-hand testing, local presence, a narrower and more exact
   answer.

Prefer queries where the answer to (3) is strong and (1) is beatable.

### 2.4 One primary intent per URL

Map queries to pages before writing anything ([C.2](#c2-keyword-to-url-map)).

- Each URL owns one primary intent. Two pages targeting the same intent
  compete with each other (cannibalization, 7.6).
- Closely related queries with the same intent belong on one page.
- A different intent (a "price today" query vs a "price on 6 May 2010" query)
  needs a different page, even when the words overlap.

### 2.5 Prioritise

Score candidate work on **impact** (demand × value per visit), **winnability**
(2.3) and **effort**. Fix technical blockers affecting many pages before
writing new content; improve pages already at positions 8–20 before targeting
new queries at 50+.

---

## Part 3 — Information architecture and URLs

### 3.1 URL rules

- **Readable and stable.** Lowercase, hyphen-separated words, no session IDs.
  A URL is an identifier; never put volatile data in it (a price, a rating, a
  stock count), or every correction breaks every link.
- **One URL per piece of content.** Protocol, host, trailing slash and case must
  be settled once and enforced with a 301/308 at the edge.
- **Hierarchy only where it is real.** `/shoes/running/` is useful;
  `/category/subcategory/type/item/` five levels deep is not.
- **Dates in URLs only for dated content** (news, archives of a specific day).
- **Language or region** as a subfolder (`/de/`) or subdomain or ccTLD — decide
  once (Part 12).
- Never change URLs without a redirect plan (Part 17).

### 3.2 Depth and hubs

- Important pages within **three clicks** of the homepage. Depth is measured
  through links, not URL segments — run the link-graph script (B.5).
- Every large set of pages needs **hub pages**: categories, indexes by year or
  letter or region, "all X" pages. They make sets crawlable and pass internal
  authority.
- **Breadcrumbs** on every page below the root: they add links up the hierarchy
  and describe the structure to crawlers.

### 3.3 Pagination

- Link paginated pages with real `<a href="?page=2">` links, not only
  "load more" buttons or infinite scroll.
- Each paginated page is **self-canonical**. Canonicalising page 2 to page 1
  tells search engines that the items on page 2 do not exist.
- Google does not use `rel="next"`/`rel="prev"` (since 2019). They do no harm.
- Do not `noindex` page 2+ by default; that can orphan the items only linked
  from there.
- Infinite scroll is fine for users if each chunk also has a paginated URL that
  loads it directly.

### 3.4 Faceted navigation and URL parameters

Filters and sorts can generate millions of URLs from a few hundred products.
This is the largest source of crawl waste on e-commerce, listings and directory
sites.

1. **Decide which facet combinations deserve an indexable page.** Only those
   with real search demand ("red running shoes", "apartments in Lyon with a
   balcony"). Give them clean, static-looking URLs, unique titles, headings and
   copy, and link to them.
2. **Everything else** — sorts, view modes, price sliders, multi-select
   combinations — should not create crawlable URLs. In order of preference:
   filter client-side without changing the URL, use a URL fragment (`#`), or
   keep a parameter and disallow its pattern in robots.txt (`Disallow:
   /*?*sort=`). Google published faceted-navigation guidance in December 2024
   along these lines.
3. `rel="canonical"` from filtered to base pages consolidates signals but does
   **not** stop crawling; `noindex` stops indexing but still costs a crawl each
   time. Neither fixes crawl waste on its own.
4. **Internal site search result pages** should not be crawlable: disallow the
   search path in robots.txt. They are infinite and thin by construction.
5. Watch for other infinite spaces: calendars with "next month" forever,
   session or tracking parameters in internal links, relative-link loops.

### 3.5 Empty, expired and closed states

| Situation | Response |
|---|---|
| Product temporarily out of stock | 200; say so clearly; show alternatives; keep structured data availability honest |
| Product permanently discontinued, close replacement exists | 301 to the replacement |
| Discontinued, no replacement | 404 or 410. Not a redirect to the homepage — Google treats mass homepage redirects as soft 404s |
| Expired listing or job | 404/410, or keep a 200 "no longer available" page *with* useful alternatives and `noindex` if it has lasting search value; `validThrough` in JobPosting |
| Category with no items right now | 200 if items will return, with helpful content; otherwise remove from navigation and sitemaps |
| A date or combination with no data | Never publish an empty template at scale. A real explanatory page (e.g. "markets were closed that day", linking the nearest real pages) with `noindex, follow` is acceptable; an empty shell is not |
| Invalid parameter (`/product/does-not-exist`) | A real 404 status — see 4.2 |

### 3.6 Legacy URLs must redirect before routes are validated

If a route only serves a known set of parameters and 404s everything else, any
old URL format it used to accept must be redirected **before** that check —
at the edge, in router configuration, or in middleware — not inside the page
component.

A real instance: a site changed its archive URLs from `/archive/2010-05-06` to
`/archive/6-may-2010` and kept the old form working by redirecting inside the
page. Later, the route was restricted to its known parameters to fix soft 404s.
The old format was no longer a known parameter, so the router 404'd it before
the page's redirect ever ran. Every external link to the old format broke, and
nothing failed: the new URLs worked, the tests passed. Only a redirect check
over the legacy URLs (B.9) shows it.

---

## Part 4 — Crawling, rendering and indexing

### 4.1 Status codes

| Code | Meaning for search |
|---|---|
| 200 | Content. Indexable if nothing else says otherwise |
| 301 / 308 | Permanent move. Signals consolidate to the target. Use these for migrations |
| 302 / 307 | Temporary. Signals may stay with the source. Some frameworks default to 307 (see Appendix A) |
| 304 | Not modified — fine, saves crawl effort when supported |
| 404 | Gone or never existed. Normal; does not hurt the rest of the site |
| 410 | Gone on purpose. Dropped slightly faster than 404 |
| 429, 5xx | Crawlers slow down; persistent errors lead to pages dropping out |
| 503 + `Retry-After` | Planned maintenance. Use it instead of serving an error page with 200 |

Redirects: one hop, straight to the final URL. Google follows up to 10 hops, but
every hop costs time and some signals; chains accumulate during migrations.

### 4.2 Soft 404s

A soft 404 is a "not found" or empty page served with **200**. Search Console
reports them; they waste crawl budget and dilute quality signals. Causes:

- A framework renders its not-found component after the response status was
  already committed as 200 (common with streaming renderers).
- Single-page apps that serve `index.html` with 200 for every path.
- Empty search results, empty categories, out-of-stock pages with no content.
- Mass redirects of removed pages to the homepage or a generic category.

**Rule.** For routes whose valid parameters are known (products, categories,
locales), reject unknown values at the routing layer with a real 404. For open
sets, set the 404 status explicitly before any content is streamed.

**Verification** — this cannot be reasoned about, only measured (B.1):

```text
404 /products/not-a-real-product
404 /category/not-a-real-category
200 /products/a-real-product        # always test a valid sibling in the same run
```

Bots probe paths like `/wp-admin`, `/.env` and `/wp-login.php` constantly; if
those return 200 with your homepage or a not-found page, you have soft 404s.

### 4.3 robots.txt

- It controls **crawling, not indexing**. A disallowed URL can still be indexed
  from links alone, without a snippet. To remove a page, allow crawling and use
  `noindex`.
- **Never disallow a URL you want de-indexed** — the crawler cannot see the
  `noindex` it is forbidden to fetch.
- **Never block CSS or JavaScript** the page needs to render.
- **Precedence** (Google, RFC 9309): one group applies per crawler — the most
  specific matching `User-agent`; groups naming the same agent are merged; `*`
  only if nothing else matches. Within the group the **longest matching rule
  wins**, and on a tie `Allow` wins. `*` matches any characters, `$` anchors the
  end. Python's `urllib.robotparser` uses first-match order and will mislead you;
  use B.2.
- Several `User-agent` lines in a row form one group:
  ```text
  User-agent: PetalBot
  User-agent: SemrushBot
  Disallow: /
  ```
- **Not supported by Google:** `crawl-delay` (Bing honours it), `noindex` in
  robots.txt (dropped 2019), `Host:` (a Yandex extension that Bing's tester
  reports as an error — remove it).
- Google reads the first **500 KiB**. A **5xx on robots.txt can halt crawling of
  the whole site**; a 404 means "no restrictions".
- Reference your sitemap(s): `Sitemap: https://www.example.com/sitemap.xml`.

### 4.4 Meta robots and X-Robots-Tag

- `noindex` — keep out of the index. `nofollow` — do not follow the page's links
  (rarely what you want on your own pages). `none` = both.
- Snippet controls: `nosnippet`, `max-snippet:N`, `max-image-preview:large`,
  `data-nosnippet` on an element. **These also control what Google's AI features
  may show** from the page.
- `X-Robots-Tag` HTTP header does the same for non-HTML files (PDFs, images) and
  can be set at the edge.
- If the **initial HTML** says `noindex`, Google may not render the page at all —
  so JavaScript cannot remove a server-sent `noindex`. The reverse (adding
  `noindex` with JavaScript) is unreliable too. Set robots directives on the
  server.

### 4.5 Canonicalization

- Every indexable page has **one self-referencing, absolute canonical**.
- Canonical, sitemap URL, internal link `href` and served URL must agree
  byte-for-byte: protocol, host, trailing slash, case, parameters.
- Parameter variants (tracking, sort) canonicalise to the clean URL; paginated
  pages do not (3.3).
- The canonical is a **hint**. Google overrides it when other signals disagree:
  internal links to another variant, sitemaps listing another variant,
  redirects, hreflang, content that is not actually a duplicate.
- Never canonicalise to a URL that redirects, 404s or is `noindex`.
- Cross-domain canonicals are for syndication: the copy points at the original.
- Near-duplicates are clustered and one representative is chosen — by search
  indexes and, per Bing (December 2025), by the systems that pick sources for AI
  answers. A page that is not the chosen representative is unlikely to be
  cited. Differentiate pages or consolidate them; do not leave near-duplicates
  to chance.

### 4.6 Sources of accidental duplication

`http` and `https`, `www` and bare domain, trailing slash variants, upper/lower
case, tracking parameters in internal links, print or AMP versions, staging or
preview hosts that are publicly reachable, CDN or platform default hostnames
(`project.vercel.app`, `site.netlify.app`), localized copies without hreflang.
Fix each with a single redirect at the edge plus consistent canonicals and
internal links.

### 4.7 Rendering and JavaScript

- **Server-render or pre-render anything that should rank.** Google renders
  JavaScript, but later and with limits; Bing renders less; several major AI
  crawlers have been measured not executing JavaScript at all. Treat the
  server-sent HTML as the only content guaranteed to be seen.
- **Links must be `<a href="…">`.** Click handlers on `div`s and buttons are not
  links to a crawler.
- **No hash routing** (`/#/products`) for content that should be indexed —
  fragments are not separate URLs.
- **Do not require interaction** (click, scroll, hover) to load primary content.
  Lazy-loading below the fold via `IntersectionObserver` or `loading="lazy"` is
  fine.
- **Status codes in client-rendered apps** must be real: serve 404 from the
  server for unknown routes, or at minimum add `noindex` to the client-side
  not-found view.
- Googlebot processes the first **15 MB** of an HTML file. Pages approaching
  that have other problems first (11.3).

### 4.8 Crawl budget

Matters mostly for large sites (tens of thousands of URLs), frequently changing
sites, and sites whose server is slow or erroring. Crawl capacity rises with
fast, error-free responses; crawl demand rises with popularity and freshness.

Waste comes from: faceted and parameter URLs (3.4), soft 404s, redirect chains,
duplicate hosts, infinite spaces, and slow responses. Search Console → Settings
→ Crawl stats shows requests, response times and file types. The crawl-rate
limiter was removed in January 2024; to slow Googlebot in an emergency, return
503 or 429 temporarily.

### 4.9 Staging, previews and security

- Staging and preview deployments: password-protect them, or at least send
  `X-Robots-Tag: noindex` from the host. A leaked staging site is duplicate
  content with your unfinished pages in it.
- HTTPS everywhere, HSTS, no mixed content.
- Watch Search Console → Security issues and Manual actions. Hacked sites get
  spam pages injected; a sudden rise in indexed pages you did not create is the
  usual first sign (18.8).

---

## Part 5 — Discovery: sitemaps, IndexNow, feeds

### 5.1 XML sitemaps

- List only URLs that return **200**, are **indexable**, and are
  **self-canonical**. A sitemap full of redirects, 404s and canonicalised-away
  URLs lowers trust in the whole file.
- **Limits:** 50,000 URLs or 50 MB uncompressed per file; use a sitemap index
  above that. Splitting by page type (products, categories, articles) makes
  Search Console's per-sitemap indexing counts diagnostic.
- **`lastmod` must be when the content meaningfully changed.** Google uses it
  only when it is consistently accurate. Stamping every URL with the build time
  destroys its only purpose; if you cannot compute a real date, omit it. B.4
  flags stamped values.
- `priority` and `changefreq` are ignored by Google.
- Reference sitemaps in robots.txt and submit them in Search Console and Bing
  Webmaster Tools. The old "ping" endpoint was deprecated in 2023 and no longer
  works.
- Special types: **image** and **video** extensions, **news sitemaps** (articles
  from the last two days, up to 1,000 URLs), and hreflang annotations (12.2).

### 5.2 The sitemap rule must match the linking reality

If you deliberately list only a subset of pages, check that internal links
respect the same boundary. A common outcome is a sitemap that withholds 10,000
archive pages while a component links to all of them — the pages are crawled
anyway, just without `lastmod`. You withheld the signal, not the crawl.

Resolve it deliberately in one direction: widen the sitemap to include what is
linked (right when those pages are valuable), or narrow the links (right when
they are incidental). Sequential previous/next navigation will always reach
unlisted neighbours — document that as intentional.

### 5.3 IndexNow

A push protocol: one POST tells Bing, Yandex, Naver, Seznam and Yep that URLs
changed. **Google does not participate** (as of 2026). It matters more than
Bing's search share suggests, because Bing's index also grounds Microsoft
Copilot and other AI products.

- Host a key file at `/<key>.txt` (the key is public by design).
- Submit **only URLs whose content changed**, never the whole sitemap on a
  schedule — that is the pattern abuse handling exists to stop.
- Submit **after the new version is live** — pinging at build time invites a
  crawl of the old page. If the deploy is asynchronous, poll a known page or
  endpoint until it shows the new version, then submit.
- 200 and 202 both mean accepted (202: key still being validated).
- A minimal submitter is in B.12.

### 5.4 Google's Indexing API is not a general tool

It officially supports only pages with `JobPosting` or `BroadcastEvent`
(livestream) markup. Google has repeatedly said other use is unsupported and
associated with spam. For everything else: accurate sitemaps, good internal
links, and URL Inspection → "Request indexing" for a handful of important URLs.

### 5.5 Feeds

RSS or Atom feeds help discovery for blogs and news, and are consumed by
aggregators and some AI tools. Include full titles, dates and canonical links.

---

## Part 6 — On-page elements

### 6.1 Titles

- Unique per page, describing the page's primary intent, **most important words
  first**. Truncation is by pixel width (~600 px): roughly 50–60 characters.
- Measure the keyword part separately from a brand suffix: in
  `Coin Melt Value Calculator — Junk Silver & Bullion | Brand`, only the suffix
  truncates, and that is fine. Drop the suffix entirely on templates where the
  title needs every character (dated archive pages, product names).
- Use the words people search with, including their exact phrasing for
  long-tail pages ("price on 18 September 2024"); matching words are shown in
  bold.
- Google rewrites titles it judges unhelpful: boilerplate repeated across
  pages, keyword stuffing, or titles that disagree with the H1. A rewrite is a
  diagnosis.

### 6.2 Meta descriptions

Not a ranking factor. Written to earn the click: the specific thing this page
has that others do not, a concrete figure, strongest clause first; roughly
150–160 characters before truncation. Google often substitutes text from the
page — a good description still wins when it matches the query.

### 6.3 Headings and layout

- One `<h1>` stating what the page is. Logical `<h2>`/`<h3>` below it.
- **Answer first.** The direct answer or the key figure near the top, then the
  detail. This serves users, snippets and answer engines alike (Part 14).
- Headings phrased the way people ask, where the section answers a question.

### 6.4 Images and video

- `alt` text describes what the image shows or does; decorative images get
  `alt=""`. Descriptive file names.
- Always set `width` and `height` (or aspect-ratio) to prevent layout shift.
- Modern formats (WebP, AVIF — Google Search supports both).
- Never lazy-load the largest above-the-fold image; give it
  `fetchpriority="high"`.
- Video: a dedicated watch page where the video is the main content, a
  thumbnail, `VideoObject` structured data, and key moments (`Clip` or
  `SeekToAction`) for long videos.

### 6.5 Social sharing metadata

Declare `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type`,
`og:locale`, `og:image` (absolute URL, ~1200×630), `og:image:width`,
`og:image:height`, `og:image:alt`; and `twitter:card`, `twitter:title`,
`twitter:description`, `twitter:image`.

**The metadata-helper trap (high severity, common).** Frameworks often inject
metadata by convention — an Open Graph image generated from a file — **only
for pages that do not declare that object themselves**. A shared helper that
always declares `openGraph` without an image therefore suppresses the image
site-wide. One real site advertised `twitter:card: summary_large_image` on every
page and emitted an image only on the homepage; every shared link rendered as a
grey box for months. No test failed. A helper must explicitly set every field it
takes ownership of; verify on one URL per template (B.3).

### 6.6 Dates

Show published and updated dates on time-sensitive content, and mirror them in
`datePublished`/`dateModified`. Update the date only for meaningful changes —
fake freshness is detectable and violates spam policies.

### 6.7 Language declarations

`<html lang>` must match the page's content. A site-wide layout that hardcodes
`lang="en"` mislabels every translated page: screen readers mispronounce it,
and Bing uses language declarations — `<html lang>` and the `content-language`
meta tag or HTTP header (`ll-cc`, e.g. `fr-FR`) — as its language and region
signals. Google says it detects language from the content itself. The hreflang checker (B.7) flags pages whose
declared language disagrees with their hreflang code.

### 6.8 Site name and favicon

Google shows a site name and favicon on every result. Provide a `WebSite`
structured-data `name` (and `alternateName`), keep it consistent with the
homepage title and `og:site_name`, and serve a favicon that is square, a
multiple of 48 px, at a stable URL.

---

## Part 7 — Content quality

### 7.1 What "helpful" means operationally

For every page, answer honestly:

1. Does it **fully satisfy the intent**, so the searcher does not go back to the
   results?
2. Does it contain **something no other page has** — original data, a
   computation, a tool, first-hand testing, a photo, a measurement, an expert's
   judgement? This "information gain" is what separates pages that rank from
   pages that are indexed and ignored.
3. Is the **purpose obvious** within seconds?
4. Would a knowledgeable person trust it and recommend it?

Word count is not a factor. A 300-word page that completely answers a narrow
query beats a 2,000-word page that pads. If (2) is "no", adding words will not
help; add substance.

### 7.2 E-E-A-T in practice

Experience, expertise, authoritativeness, trust are evaluated from evidence on
and off the page. What produces the evidence:

- **Real authorship**: bylines linking to author pages with actual credentials,
  experience and other work; `Person` structured data.
- **First-hand experience** shown, not claimed: original photos, test results,
  screenshots, data, the specific details only someone who did it would know.
- **Sources** cited and linked, especially for figures and claims.
- **About, contact and editorial policy** pages; who owns the site and how to
  reach them; for commerce, clear returns and shipping policies.
- **YMYL topics**: named expert review, dates of review, conservative claims.

### 7.3 AI-assisted content

Using AI to write is not itself a violation. Google's **scaled content abuse**
policy (March 2024, the focus of several 2026 spam updates) is method-agnostic:
large volumes of pages made to rank rather than to help, whether written by
models, people or scrapers. In practice:

- A human with subject knowledge reviews, corrects and adds what the model
  cannot: data, experience, judgement.
- Never publish at scale what nobody has read.
- Facts, figures and quotes are checked against sources — models invent them.

### 7.4 Freshness and decay

- Time-sensitive topics need real updates; evergreen topics need periodic
  review. Update `dateModified` only for meaningful changes.
- Track content decay: pages whose impressions fall steadily over three or more
  months. Update, consolidate or retire them.

### 7.5 Prune and consolidate with data

For each weak page (few impressions, no links, no conversions over 6–12
months), choose one:

| Situation | Action |
|---|---|
| Overlaps a stronger page | Merge the useful parts into it; 301 the weak URL |
| Has potential, poorly executed | Rewrite |
| Useful to users but not a search target | Keep, `noindex` |
| No value to anyone | Remove: 404/410, delete internal links and sitemap entries |

Never delete pages that have backlinks without redirecting them.

### 7.6 Cannibalization

Two or more of your URLs competing for the same query, each ranking worse than
one would. Symptoms: rankings alternating between URLs, or a broader page (a
month summary) ranking for a query a specific page (the day) answers better.

Diagnose with Search Console: filter by query, compare pages. Fix by:

1. Making each page's intent distinct (titles, H1s, content that answers
   different questions).
2. **Pointing internal links with descriptive anchors at the page that should
   win** — the strongest lever you control.
3. Linking the broader page down to the specific one ("prices on each day of May
   2010").
4. Consolidating (301) when the pages genuinely serve one intent.

### 7.7 Formats that still earn clicks and links in 2026

When AI answers take simple informational queries, what still earns visits:
original data and research, working tools and calculators, comparisons based on
real testing, templates and downloads, expert opinion with a name attached,
local and first-hand content, community discussion, and video.

### 7.8 User-generated content

Moderate it; spam in comments and profiles is still your content. Mark links
`rel="ugc"` (and `nofollow` where unmoderated). Thin profile pages and empty
threads: `noindex` until they have content.

---

## Part 8 — Templated and programmatic pages at scale

Any site with a template rendered many times — products, locations,
integrations, listings, dated archives, glossary terms — faces the same
question: **does each page carry enough independent value to deserve a place
in the index?**

### 8.1 When it is legitimate

Programmatic pages are fine when each page answers a distinct query that people
actually search, with data or content specific to that page. They are scaled
content abuse when the template is the only content and the variable is the
only difference ("Best plumber in {city}" × 2,000).

### 8.2 The value test and the subtraction test

For a sample of pages from one template:

1. Remove the shared chrome — header, footer, navigation, repeated
   boilerplate. What remains?
2. Is what remains **different in substance** from page to page, or only in the
   substituted words?

Measure it (B.8): render 15–30 pages of one template, take the main content,
compute pairwise similarity over word shingles, report the median.

```text
median similarity   > 90%    expect a handful indexed and the rest ignored
                 80–90%      marginal; the long tail will struggle
                   < 80%     each page carries real independent content
```

**Treat the number as relative.** It depends on shingle size and page length:
with 6-word shingles, one changed word removes six shingles, so short pages
swing wildly. Compare the same template before and after a change, with the
same settings. A drop from 95% to 83% is real progress; a third decimal place is
noise.

A low score rules duplication *out* as the reason pages are not indexed — then
look at demand and authority instead. One archive of dated pages measured
~21% median similarity while hundreds of its pages sat in "Crawled – currently
not indexed": those were old dates few people search for, not duplicates.

### 8.3 How to make pages genuinely different

- **Different templates chosen by the data.** Classify each page by what its
  data shows and render a structurally different page per class: a record high,
  a large fall, a quiet day and a reversal each get their own headline, emphasis
  and narrative order.
- **Computed narrative, not filler**: "the highest close since 14 March 2011",
  "the third weekly decline in a row", "larger than 98% of sessions on record".
  These sentences differ because the facts differ.
- **Page-specific elements**: nearby items, records relevant to this page only,
  comparisons computed for this page, local details, real reviews.

Substituting a different number into the same sentence does not change the
measurement, and does not change the search engine's judgement either.

### 8.4 An explicit index policy per tier

Decide, in **one exported and tested function**, which pages are:

| Tier | Criteria (examples) | Treatment |
|---|---|---|
| Publish and index | Enough data or content; evidence of demand | 200, in sitemap, linked from hubs |
| Publish, don't index | Useful to visitors who arrive, no search value (a date the market was closed, a filter view) | 200, `noindex, follow`, not in sitemap |
| Don't publish | No data, no content | No page; 404 if requested |

Burying this rule in a sitemap loop or a component condition means it drifts
between the sitemap, the links and the pages. It decides what the world sees;
it deserves a test.

### 8.5 Roll out in bands

Publish the segment with proven demand first, watch how much is indexed over
4–8 weeks, then widen. Releasing tens of thousands of URLs on a young domain at
once gets most of them classified as low value, and that judgement is slow to
reverse. Watch "Discovered" and "Crawled – currently not indexed" per sitemap
(split sitemaps by segment so you can).

### 8.6 Programmatic pages cost money to serve

Every page that exists will be crawled — by search engines, AI crawlers and SEO
tools — and every crawl of a page not in cache costs compute and transfer.
Before publishing 10,000 pages, estimate what one full crawl costs on your host
(Part 15.4). Prerendering them at build time is often far cheaper than
rendering on demand.

---

## Part 9 — Structured data

### 9.1 Principles

- Use **JSON-LD**. Describe only what is **visible on the page**; marking up
  hidden or different content violates spam policies.
- Structured data is not a ranking factor. It makes pages **eligible** for rich
  results (never guaranteed) and makes entities unambiguous to machines,
  including answer engines.
- Build one connected graph: an `Organization` and `WebSite` defined once with
  an `@id`, referenced from pages rather than repeated.
- **Validate the JSON itself.** A duplicated key inside an object silently keeps
  only the last value; `JSON.parse` never warns (B.3 detects it).
- Test each template in Google's Rich Results Test *and* the Schema.org
  validator — they catch different things — and watch Search Console's
  enhancement reports after release.

### 9.2 What still produces something visible (as of September 2026)

| Type | Use for | Notes |
|---|---|---|
| `Organization` | Site-wide, once | Logo (≥112×112), `sameAs` official profiles, contact; merchant return and shipping policies can be nested here |
| `WebSite` | Site-wide | Site name shown in results (`name`, `alternateName`) |
| `BreadcrumbList` | Every page below the root | Shown in desktop results; Google stopped showing breadcrumbs on mobile in January 2025. Still worth emitting |
| `Article` / `NewsArticle` / `BlogPosting` | Editorial | Headline, images, dates, author with URL |
| `Product` + `Offer` | Product pages | Product snippets and merchant listings: price, availability, shipping, returns, reviews. `ProductGroup` + `hasVariant` for variants; `Product.category` and sale-price date ranges added to merchant-listing docs in July 2026 |
| `Review` / `AggregateRating` | Reviews of products, recipes, software, etc. | Self-serving reviews of your own business (`LocalBusiness`/`Organization`) are not eligible |
| `LocalBusiness` (subtypes) | Location pages | Must match the business profile |
| `Event` | Events with dates and places | |
| `JobPosting` | Job pages | `validThrough`; the only content type (with livestreams) allowed in the Indexing API |
| `Recipe` | Recipes | |
| `VideoObject` | Watch pages | Key moments via `Clip` / `SeekToAction` |
| `Dataset` | Pages publishing datasets | Shown in Google Dataset Search |
| `SoftwareApplication` | Apps and tools | Ratings, price |
| `DiscussionForumPosting`, `QAPage` | Forum threads, Q&A | Feeds "discussions and forums" features |
| `ProfilePage` | Creator/author profiles | |
| Paywall (`isAccessibleForFree` + `hasPart`) | Subscription content | Distinguishes a paywall from cloaking |

### 9.3 Retired — do not justify work with these

| Feature | Status |
|---|---|
| FAQ rich results | Limited to government and health sites in August 2023; no longer shown at all from May 2026; Search Console report removed June 2026 |
| HowTo rich results | Removed in 2023 |
| Sitelinks search box | Removed November 2024 |
| Book Actions, Course Info, Claim Review, Estimated Salary, Learning Video, Special Announcement, Vehicle Listing | Retired June 2025 |
| Practice Problem | Deprecated January 2026 |

The vocabulary itself is still valid Schema.org, and `FAQPage` or `HowTo` markup
does no harm as entity description — but it will not produce a result feature,
so never promise one.

### 9.4 Entities

Consistent names, addresses, profiles and logos across your site, business
profile, social profiles and directories help search engines and answer engines
resolve who you are. `sameAs` links from `Organization`/`Person` to official
profiles. Do not create Wikipedia or Wikidata entries for entities that are not
notable; they get deleted and it looks like spam.

---

## Part 10 — Internal linking

### 10.1 Measure what matters

- Count **in-content** links only. Header, footer and sidebar links appear on
  every page; including them gives every page the same score and hides the real
  structure.
- **Inbound matters more than outbound.** A page's internal authority comes from
  how many other pages' body content links to it.
- Measure on the **rendered DOM** of a production build (B.5). A regex over
  streamed HTML can report zero links everywhere.

### 10.2 Rules

- Every indexable page has **at least three in-content inbound links** from
  relevant pages. Zero is an orphan, even if it is in the sitemap and the menu.
- Aim for a spread no worse than roughly **10:1** between the most- and
  least-linked important pages.
- **Descriptive anchor text** that says what the target is. Never "click here" or
  bare URLs.
- **Cross-link siblings**: two pages covering parallel topics (gold and silver
  versions, two neighbouring cities, two competing products) should link to
  each other. This is the most commonly missed link on any site.
- Related-link blocks of 4–8 topical links are good; 30 links is a link farm.
- Link **down** from broad pages to the specific pages that should rank for
  specific queries (7.6).
- Do not `nofollow` your own internal links.

### 10.3 The link-library pattern and its failure mode

A central registry mapping a key to `{ href, label, description }`, from which
pages pick related links, keeps anchor text consistent and auditable. Its
failure mode: **a page missing from the library can never be linked from body
content**. Pages added after the library was written get forgotten — on one
real site four pages had one in-content inbound link each while the most-linked
had 46, purely by omission.

Guard it with a test that reads **both sides from the repository**: enumerate
routes from the filesystem, extract hrefs from the library, and fail when a
route (minus an explicit exemption list) is missing. Do not mirror the library
in the test; that only checks a copy against the original.

### 10.4 Prefetching long-tail links costs money

Frameworks that prefetch every link as it scrolls into view (Next.js does by
default) turn one page view into many background requests. For popular pages
these hit the CDN cache and cost nothing. For a large long-tail archive,
nearly every prefetch misses the cache and is billed — for pages the visitor
usually never opens. Disable prefetch on links into large long-tail sets; keep
it on navigation to popular pages. Crawlers follow the `href` either way.

---

## Part 11 — Performance, page experience and page weight

### 11.1 Core Web Vitals

| Metric | Good | Measures |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5 s | Loading |
| INP (Interaction to Next Paint) | ≤ 200 ms | Responsiveness (replaced FID in March 2024) |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | Visual stability |

Assessed at the **75th percentile of real users** (field data, Chrome UX
Report), per page or page group, over 28 days. Lab tools (Lighthouse) help
diagnose but are not what Search uses. Page experience acts more as a
tie-breaker than a primary ranking factor — but it moves conversions, and a
slow, heavy page costs more to serve.

### 11.2 Fixes by metric

- **LCP**: fast server response (cache HTML at the CDN), the hero image not
  lazy-loaded and given `fetchpriority="high"`, correctly sized images in modern
  formats, critical CSS inline, fewer render-blocking scripts, web fonts with
  `font-display: swap` and preloading.
- **INP**: ship less JavaScript; break up long tasks; avoid hydrating large
  component trees; defer third-party scripts; keep event handlers light.
- **CLS**: `width`/`height` or `aspect-ratio` on images, videos and embeds;
  reserved space for ads, banners and late-loading components; no content
  inserted above what the user is reading.

### 11.3 Page weight is a cost, not just a speed problem

Hosts that meter cache reads, origin transfer or function time charge by the
byte. On some platforms every cache miss is billed per few KB of stored page.
A page that is 4 MB instead of 250 KB costs ~16× more **on every uncached
request** — and on a small site most requests come from bots (Part 15).

The most common cause is **serialized data the page never shows**. Component
frameworks embed the props of client components in the HTML so they can hydrate.
Pass a chart component 26 years of daily prices and all 6,500 points are
embedded, even if the chart draws 400. A real site found up to 98% of its
heaviest pages was chart data that the browser discarded:

- Price charts drew at most 400 points and received 6,500.
- Indicator panels drew the last 180 and received the full series.
- A "download CSV" button carried the whole dataset in every page for the few
  visitors who clicked it.

Fixes that changed nothing visible:

- **Trim on the server to what is drawn**, using the *same function* the client
  applies, so the client's step becomes a no-op. Prove equivalence with tests
  against the old client logic.
- **Load long ranges on demand**: ship the recent window; fetch the full series
  from a cached API or static file only when the user asks for it.
- **Fetch downloadable data on click**, not on page load.

Result: 3.9 MB → 278 KB on the heaviest page, 830 KB → 195 KB on the homepage.
Measure with B.6; set a budget per template and check it in CI.

Streaming component frameworks (React Server Components and similar) send the
rendered tree twice — once as HTML, once as a payload for hydration — so ~50%
of the HTML being inline script is normal for them. The warning sign is
thousands of repetitions of one data key.

### 11.4 Mobile

Google indexes the mobile version. Content, links, structured data and
metadata must be the same on mobile as on desktop; content hidden in
accordions is fine, content absent on mobile is not indexed. Viewport meta, tap
targets, readable text without zoom. No intrusive interstitials covering the
content on arrival (legal cookie and age banners are acceptable).

### 11.5 Third-party scripts

Tag managers, chat widgets, A/B testing and ad scripts are the usual cause of
poor INP and LCP. Audit them quarterly: remove what nobody uses, defer the rest,
load chat on interaction.

### 11.6 Accessibility overlaps

Alt text, heading structure, `lang`, descriptive link text, form labels and
sufficient contrast serve users, crawlers and answer engines at once. An
accessible page is a machine-readable page.

---

## Part 12 — International and multilingual

### 12.1 Choose a URL structure once

| Structure | Example | Notes |
|---|---|---|
| Subfolders | `example.com/de/` | Shares the domain's authority; easiest to run. The default choice |
| Subdomains | `de.example.com` | Treated more like separate sites |
| ccTLDs | `example.de` | Strongest country signal; separate authority per domain; costly |
| Parameters | `?lang=de` | Avoid |

### 12.2 hreflang

- **Reciprocity is mandatory.** If A lists B, B must list A. One-way pairs are
  ignored.
- Every member lists **every member, including itself**.
- One `x-default` for users who match none.
- **Valid codes**: ISO 639-1 language, optionally a script and an ISO 3166-1
  region (`en-GB`, `pt-BR`, `zh-Hant`). Common mistakes: `en-UK` (use `en-GB`),
  `jp` (`ja`), `cn` (`zh`), `gr` (`el`), `se` (`sv`), `dk` (`da`), `cz` (`cs`),
  `kr` (`ko`), `vn` (`vi`), `ua` (`uk`). And `uk` means **Ukrainian**, not
  United Kingdom.
- Every target returns **200**, is **indexable** and **self-canonical**; one
  broken member can void the cluster.
- Implement in HTML `<link>` tags, HTTP headers (for non-HTML), or sitemaps —
  one method, consistently.
- For Bing, also declare each page's language and region with `<html lang>` and
  the `content-language` meta tag or header (6.7).
- Frameworks may emit the attribute as `hrefLang`; **match case-insensitively**
  when auditing, or you will conclude correct tags are missing.
- Check with B.7.

### 12.3 Regional variants are not translations

Two English pages for different regions (US dollars and British pounds) are a
legitimate hreflang cluster (`en`, `en-GB`, `x-default`); without it they
compete for the same queries. Keep region handling separate from translation in
code; conflating them produces clusters that mix both incorrectly.

### 12.4 Do not redirect by IP or browser language

Googlebot crawls mostly from US addresses; automatic redirects by location hide
other versions from it, and frustrate travellers. Suggest a version with a
banner; let people choose; remember their choice.

### 12.5 Translate properly

Machine translation without review reads as low quality and can fall under
scaled content abuse. Localize what matters locally: currency, units, examples,
payment and shipping details, legal pages. Declare the correct `<html lang>` on
every localized page (6.7).

---

## Part 13 — Authority and off-page

### 13.1 Measure it honestly

- **Referring domains**, not backlink counts. 217,000 backlinks from 2 domains
  is one site-wide footer link — one vote. Above ~1,000 links per referring
  domain is boilerplate or a scraper network.
- Third-party "authority scores" are proxies computed by tool vendors from their
  own crawls. Use them for trends and comparisons, not as truth. Blocking a
  tool's crawler from your site does not change a score computed from links on
  other sites.
- The trend that matters: new referring domains from relevant sites per month,
  and branded search volume.

### 13.2 What earns links

Links that move authority are **editorial** (someone chose to link) from
**topically relevant** sites. What reliably earns them:

1. **Original data and research** others cite.
2. **Free tools and calculators** others embed or reference.
3. **Free APIs and open datasets** — documented, keyless, CORS-enabled, with an
   OpenAPI spec (3.0.x is the most widely ingested). Then **submit them**: the
   `public-apis` list on GitHub, APIs.guru, API marketplaces, relevant
   "awesome" lists. Building the asset and never distributing it is the most
   common failure.
4. **Being the definitive answer** to a question in your niche.
5. **Expert commentary** for journalists (source-request services), podcasts,
   conference talks.
6. By site type: integration directories and marketplaces (SaaS), local
   chambers, sponsorships and press (local), open-source projects (developer
   products), industry associations (B2B).

### 13.3 What not to do

- Paid links without `rel="sponsored"`, link exchanges at scale, private blog
  networks, guest-post farms: link spam policy, increasingly well-detected.
- **Expired domain abuse** (buying dropped domains for their links and
  redirecting them) and **site reputation abuse** (hosting third-party content
  to exploit your domain's standing) — both named spam policies since March
  2024.
- Keyword-matched domain lists match strings, not topics: a search for "gold"
  returns sneaker replicas and game-currency sellers. Irrelevant links pass
  nothing.

### 13.4 Disavow rarely

Google ignores most spam links automatically. Use the disavow tool only after a
manual action for unnatural links, or when you know of a paid-link campaign on
your behalf.

### 13.5 Brand

Branded search, consistent profiles, reviews and mentions (even unlinked) are
part of how search engines and answer engines judge prominence. Check what
appears when someone searches your brand name; that page of results is your
most visited page you do not control.

---

## Part 14 — AI search and answer engines

### 14.1 The landscape (as of 2026)

Google shows AI Overviews and AI Mode; Microsoft Copilot answers from Bing's
index; ChatGPT, Perplexity, Claude and Gemini search the web and cite sources.
Most of these ground their answers in a **search index** — their own or one
they license — so the foundation is unchanged: be crawlable, indexed and
ranking. Two consequences:

- **Bing matters beyond its share of search**, because its index grounds Copilot
  and other assistants. Verify the site in Bing Webmaster Tools and use IndexNow.
- **Simple factual queries lose clicks.** Ranking first for a one-number answer
  now often earns a citation and an impression, not a visit. Plan for citation
  value (brand, trust) as well as traffic.

### 14.2 What gets cited

- **A direct answer first**, then detail. Answer the question in the heading and
  the sentence beneath it.
- **Specific, checkable facts** with units, dates and sources. "Gold closed at
  $5,318.40 on 29 January 2026" is citable; "gold has performed strongly" is not.
- **Tables** for comparisons and figures — extractable and unambiguous.
- **Named entities**: the organisations, standards, places, products and
  regulations involved.
- **Stated methodology**: how a number was computed, over what period, from what
  source.
- **Distinct pages.** Near-duplicates collapse into one chosen representative
  (4.5); the others are unlikely to be cited.
- **Content in the server HTML** — many AI crawlers do not run JavaScript (4.7).

### 14.3 Publish measured uncertainty

If you publish a forecast, estimate or score, **publish its measured accuracy
against a naive benchmark** (for a time series: "assume no change"; report the
error ratio from a rolling backtest). If the honest result is "no better than
assuming no change", say so. It reads as a weakness and works as a
differentiator: a checkable fact in a category full of unfalsifiable confidence.
Precision theatre — a next-week range quoted to the cent — is trivially
detectable.

### 14.4 Measure AI visibility

| Source | What it shows | Caveats |
|---|---|---|
| Search Console → Generative AI performance (June 2026) | Impressions in AI Overviews, AI Mode and Discover AI features, by page, country, device, date | Impressions only — no clicks, queries or positions yet; data from 18 May 2026 |
| Bing Webmaster Tools → AI Performance (preview since Feb 2026) | Citations in Copilot and Bing AI answers, grounding queries, cited pages; since June 2026 Intents, Topics, Citation Share, Compare | Sampled and revised retroactively; a backfill on 1 June 2026 created a jump that was not real visibility — annotate it |
| Analytics referrals | Visits from `chatgpt.com`, `perplexity.ai`, `copilot.microsoft.com`, `gemini.google.com`, etc. | Some assistants strip referrers |
| Server logs | User-triggered fetchers (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) visiting pages | A proxy for being consulted, not cited |

### 14.5 Decide which AI crawlers to allow

Vendors separate crawlers by purpose. Check each vendor's current documentation;
tokens change.

| Purpose | Examples (2026) | Default for most sites |
|---|---|---|
| Search/citation indexing | `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `bingbot`, `Applebot` | Allow — this is how you get cited |
| User-triggered fetch | `ChatGPT-User`, `Claude-User`, `Perplexity-User` | Allow — a person asked about your page |
| Model training | `GPTBot`, `ClaudeBot`, `CCBot` (Common Crawl), `meta-externalagent`, `Amazonbot`, `Bytespider` | A business decision: licensing, cost, principle |
| Opt-out tokens (no separate crawler) | `Google-Extended` (Gemini training and grounding), `Applebot-Extended` (Apple AI training) | Blocking these does **not** remove you from Google Search or AI Overviews |

To limit what Google's AI features show from a page, use the normal snippet
controls (`nosnippet`, `max-snippet`, `data-nosnippet`), not `Google-Extended`.
Some crawlers have been reported to ignore robots.txt; enforce with firewall
rules where it matters (15.3).

### 14.6 llms.txt

A proposed convention (llmstxt.org): a Markdown summary of the site and its key
URLs at `/llms.txt`. No major search engine has committed to using it; Google
has said it does not. It is cheap and most useful for developer documentation
that coding assistants fetch. If you publish one:

- **Only real, absolute URLs that return 200.** Never placeholders:
  `/products/{id}`, `/archive/YYYY`, `/section/...` read fine to a person and look
  exactly like URLs to a crawler, which will request them and log 404s.
- Derive example URLs from live data rather than hardcoding them, so they cannot
  rot.
- Keep facts current (generate it at build time).
- Test it: extract every URL and fetch it.

### 14.7 Do not try to manipulate AI answers

Since **15 May 2026** Google's spam policies explicitly cover attempts to
manipulate generative AI responses in Search — self-serving "best X" listicles
that rank their author first, hidden instructions aimed at models,
"recommendation poisoning". Tactics that are spam for rankings are spam for AI
answers.

---

## Part 15 — Bots, crawl cost and hosting

### 15.1 On a small site, most traffic is bots

A site with a few hundred human visits a day can see tens of thousands of
requests from crawlers: search engines, AI crawlers, SEO tools, scrapers,
vulnerability scanners. Crawlers visit the long tail that humans never do, so
they miss the cache far more often — and cache misses are what hosts bill.

### 15.2 Triage from data, not assumption

Get the breakdown: host dashboards often have one (e.g. requests by bot name
with cache-hit rate); otherwise use server logs (B.11). For each agent, weigh
**requests × cache-miss rate × page weight** against **value returned**:

| Agent | Value | Typical action |
|---|---|---|
| Googlebot, Bingbot | Your organic traffic | Never block. Make their crawl efficient instead (4.8) |
| Applebot, DuckDuckGo, Yandex, Naver, Seznam | Traffic in their markets | Allow |
| AI search and user-triggered fetchers | Citations, referrals | Usually allow (14.5) |
| AI training crawlers | None directly | Policy decision |
| SEO tools (Semrush, Ahrefs, Majestic, DotBot, DataForSEO…) | None to you, unless you use that tool on your own site | Usually block; keep the tool's site-audit agent if you use it |
| Search engines irrelevant to your market | Negligible | Block if costly (e.g. a China-focused engine on a US-only site) |
| Unidentified scrapers, fake Googlebots | Negative | Firewall |

**Verify search engine crawlers by DNS**, not by user-agent: reverse-resolve the
IP, check the name ends in `googlebot.com`, `google.com` or
`googleusercontent.com` (Bing: `search.msn.com`), then forward-resolve that name
back to the same IP (B.11). Anyone can send a Googlebot user-agent.

### 15.3 How to block

| Mechanism | Stops | Speed | Cost |
|---|---|---|---|
| robots.txt `Disallow` | Polite crawlers | Next time they fetch robots.txt (~a day) | Free |
| Host/CDN firewall rule by user-agent or network | Everyone matched | Immediate | Usually free; blocked requests do not reach your app |
| Rate limiting | Aggressive crawlers | Immediate | Free–cheap |
| Application middleware check | Everyone | Immediate | **Runs a function on every request** — can cost more than the crawling it prevents |

### 15.4 What your host meters

| Meter | What drives it | SEO-related causes |
|---|---|---|
| CDN transfer / edge requests | Every request and byte served | Heavy pages, bots, prefetching |
| Cache or ISR reads | Cache misses reading stored pages, often billed per few KB | Long-tail pages crawled once each, **deploys that purge the cache**, heavy pages, prefetching |
| Cache or ISR writes | Pages generated or regenerated after build | Revalidation timers, pages rendered on demand instead of at build |
| Function invocations / CPU | Server rendering, APIs, middleware | Dynamic rendering of cacheable pages, middleware on every request |
| Build minutes | Builds | Prerendering very large page sets on every deploy |

Traps met in practice:

- **A timer inside a page overrides the page's own caching.** Some frameworks
  take the *shortest* revalidation interval among the page and every data fetch
  inside it; one fetch with an 8-hour timer made "never revalidate" pages
  regenerate around the clock.
- **On-demand rendering, not timers, can be the real bill.** In one case 26
  timed revalidations sat beside 6,900 writes from pages rendered on first
  request across 3,600 unique URLs. Read the per-route breakdown before
  deciding the mechanism.
- **Every deploy can purge the CDN cache**; frequent content-driven deploys
  (e.g. a data refresh twice a day) make every page cold again.
- **Prefetching** long-tail links (10.4).

### 15.5 When a usage alert arrives

1. Open the platform's per-route and per-agent breakdown; do not guess.
2. Rank routes by **bytes**, not request counts — a page read 70 times at 4 MB
   outweighs one read 3,000 times at 15 KB.
3. Check cache-hit rate per route, the bot share, and page weight (B.6).
4. Fix in order: page weight → cacheability (prerender, no stray timers) →
   bot triage → prefetch → deploy frequency.
5. Re-measure after a full day on the new deploy; compare equal windows.
6. Say plainly whether the fixes will get under the limit. If the remaining cost
   is Googlebot crawling pages that earn traffic, that is the price of the
   traffic — a bigger plan may be the right answer, not blocking the crawler.

---

## Part 16 — Measurement and diagnosis

Read this before reporting any number. Every rule below comes from a
measurement that was wrong.

### 16.1 Tools and what each is for

| Tool | For | Not for |
|---|---|---|
| Search Console | Google impressions, clicks, positions, indexing, rich results, crawl stats | Traffic value; anything off Google |
| Bing Webmaster Tools | Bing and Copilot performance, AI citations, crawl, keyword research, IndexNow | — |
| Analytics | Visits, engagement, conversions by landing page | Search rankings |
| Server/CDN logs, host dashboards | What crawlers actually request; cost | Rankings |
| Chrome UX Report / PageSpeed Insights | Real-user Core Web Vitals | Diagnosing a single interaction |
| Third-party SEO tools | Competitor and backlink estimates, keyword ideas | Ground truth about your own site |

### 16.2 Reading Search Console Performance correctly

- **Position** is the average of the *topmost* position you held for each
  impression. A page ranking 3 for one query and 60 for another averages
  somewhere in between; always read position per query.
- **Anonymized queries**: rare queries are withheld for privacy. The query table
  can account for a small fraction of clicks — on one site 3 of 121 clicks over
  28 days. Page-level totals are complete; query-level totals always undercount.
- **Exports stop at 1,000 rows**, sorted by clicks and then impressions. A query
  or page *absent* from an export is not "zero" — it had no more impressions than
  the last row. Use the API or the BigQuery bulk export for complete data.
- **Aggregation differs**: the chart counts by site, the page table by URL, so
  their totals differ slightly. That is expected.
- Data lags ~2 days and is kept for 16 months. Export regularly if you need
  longer history.
- **Compare equal windows** (the last 14 days vs the 14 before, or year over
  year), never a week against its best single day, and never a 7-day export
  against a 28-day one. Short windows cannot carry a trend.
- AI features: the standard report mixes in clicks from AI features without
  separating them; the Generative AI report (14.4) isolates impressions only.

B.10 reads an export in any UI language and prints these corrections alongside
the numbers.

### 16.3 The page indexing report decoded

| Status (English) | French UI | What it means | Normal when | Act when |
|---|---|---|---|---|
| Crawled – currently not indexed | Explorée, actuellement non indexée | Google fetched it and chose not to index it (yet) | Old or low-demand long-tail pages; freshly crawled batches sit here for weeks | Recent, high-value or hub pages appear here; the count keeps rising for 4+ weeks — check duplication (B.8), value, demand |
| Discovered – currently not indexed | Détectée, actuellement non indexée | Known, not yet crawled | Young domains with many new pages; it drains slowly | It never drains; server slow or erroring; crawl waste (4.8) |
| Excluded by 'noindex' tag | Exclue par la balise "noindex" | You asked | Every URL here is one you meant to exclude | A page you want indexed is here |
| Page with redirect | Page avec redirection | Redirecting URL, not indexed itself | Old URLs after migrations | Internal links or sitemaps still point to redirects |
| Not found (404) | Introuvable (404) | 404 when crawled | Removed pages; junk URLs from bots or from strings in JavaScript (`/$`, `/undefined`) | Real pages you link to internally appear |
| Alternate page with proper canonical tag | Autre page avec balise canonique correcte | Duplicate correctly pointing elsewhere | Parameter variants, regional copies | — |
| Duplicate without user-selected canonical | | Google found duplicates and you declared no canonical | — | Add canonicals; remove the duplication |
| Duplicate, Google chose different canonical than user | | Your canonical was overridden | — | Signals disagree (4.5); fix links, sitemaps, redirects |
| Soft 404 | | 200 with not-found or empty content | — | Always (4.2) |
| Blocked by robots.txt | | Disallowed | Deliberately blocked sections | A page you want indexed |
| Indexed, though blocked by robots.txt | | Indexed from links without being crawled | — | Allow crawling and use `noindex`, or allow and index |
| Server error (5xx), Redirect error | | Fetch failed | Isolated blips | Repeated; the site is slow or unstable |

Clicking a status shows up to 1,000 example URLs. **Always look at the
examples before concluding anything**: a jump in "crawled, not indexed" made of
2006 archive pages means something different from one made of product pages.
"Validate fix" is for problems you have fixed; do not press it for a correct 404.

### 16.4 Normal noise

- **404s for URLs nobody links to.** Google extracts path-like strings from
  JavaScript; framework code such as `replace(/\/$/, "")` yields a crawl of
  `/$`. Check that no internal link points there (B.5), then ignore it. Do not
  block it in robots.txt.
- Bots requesting `/wp-login.php`, `/.env`, `/admin` on sites that have none.
- Weekly cycles (weekends), holiday dips, seasonal topics.
- Movement for a week or two during core and spam updates.
- **Data events presented as trends**: platform backfills and reporting changes.
  Record them in the change log with their date.

### 16.5 Attribution

- Keep a **dated change log** of every deploy that touches SEO-relevant behaviour
  (C.5). Without it, a drop cannot be matched to its cause.
- Compare **cohorts**: pages changed vs similar pages not changed, same window.
- Allow 2–6 weeks for indexing and ranking changes to settle; crawl
  frequency limits how fast any change is seen.
- Before crediting or blaming a change, check: algorithm updates in the window,
  seasonality, tracking changes, and SERP changes (an AI Overview appearing on a
  query removes clicks without any change in position).

### 16.6 Measurement traps

| Trap | Effect | Guard |
|---|---|---|
| Regex over streamed HTML | Zero links or words on full pages | Rendered DOM for content |
| Old server still running (`EADDRINUSE`) | Measuring the previous build | Read the server log; kill by PID |
| `pkill -f pattern` in a compound command | Can match and kill its own shell | Kill by PID; check what is listening on the port |
| Case-sensitive attribute search | `hrefLang` misses `hreflang` | Case-insensitive, or parse the DOM |
| Missing `content-length` on streamed responses | "0 KB" pages | Measure the body |
| HTML entities | `&amp;` makes source text longer than displayed | Decode before measuring lengths |
| Development build | Different metadata, no static generation | Always audit production builds |
| CDN serving a cached old version | "The fix did not work" | Cache-busting query or wait for purge |
| Comparing unequal windows | Invented trends | Equal windows (16.2) |
| Secondary sources | Repeated wrong "facts" | Primary documentation |

### 16.7 What to report

A monthly report ([C.6](#c6-monthly-report-outline)) answers: what changed, what
it did (equal windows, cohorts), what is broken, what is next, and what data
would change the plan. Lead with the conclusion; show the command or source for
each number.

---

## Part 17 — Launches, migrations and redesigns

Migrations are where sites lose half their traffic in a day. Most losses come
from missing redirects, changed content, and forgotten `noindex`.

### 17.1 Launching a new site

Before launch ([D.1](#d1-pre-launch) has the full list):

- Remove staging `noindex` and robots.txt blocks — the single most common launch
  failure.
- One canonical host enforced by redirect; HTTPS.
- Real 404s for unknown URLs (B.1).
- Sitemaps listing only indexable URLs (B.4).
- Titles, descriptions, canonicals, social tags, structured data on every
  template (B.3).
- Search Console and Bing Webmaster Tools verified; sitemaps submitted;
  analytics recording.

After launch: request indexing for the homepage and key hubs; watch the Pages
report weekly for the first two months.

### 17.2 Migration types

| Type | Main risk |
|---|---|
| Domain change | Everything: authority must transfer through redirects |
| HTTP → HTTPS | Mixed content, redirect gaps |
| URL restructure | Missing or wrong redirect mappings |
| Platform or framework change | Rendering, metadata, status-code behaviour all change at once |
| Redesign | Content removed or moved behind interaction; internal links changed |
| Merging sites | Mapping two inventories onto one; consolidation of duplicates |

Avoid doing several at once. Each one alone is recoverable.

### 17.3 The migration plan

1. **Inventory every URL that matters**: from sitemaps, a crawl, Search
   Console's page export (3 and 16 months), analytics landing pages, and
   backlink tools. Pages with links or traffic are non-negotiable.
2. **Map each old URL to its closest equivalent** in a CSV (C.4). One-to-one
   where possible. Never redirect everything to the homepage — that is treated
   as a soft 404 and the value is lost.
3. **Implement permanent redirects (301/308), one hop, at the edge or router**,
   before any route validation (3.6). Verify the whole map with B.9 on staging
   *before* launch.
4. **Update everything that references URLs**: internal links, canonicals,
   hreflang, structured data, sitemaps (new URLs only), robots.txt, social
   profiles, and your own external listings.
5. **Keep the redirects for at least a year**, and ideally permanently.
6. Domain moves: use Search Console's Change of Address tool; keep the old
   domain registered.
7. **Monitor for 8–12 weeks**: redirect check daily for the first week, 404s,
   indexing per sitemap, traffic per template compared with the same template
   before.
8. Define **rollback criteria** in advance (e.g. template traffic down more than
   X% for two weeks with no recovery trend).

### 17.4 Redesigns without URL changes

Run the page audit (B.3), page weight (B.6), link graph (B.5) and similarity
(B.8) on every template **before and after**. Redesigns remove content, move it
behind tabs that load on click, drop internal links from navigation, and change
metadata helpers — none of which shows in visual review.

---

## Part 18 — Troubleshooting playbooks

### 18.1 A page is not indexed

1. **Status**: does it return 200 to a crawler (B.1)? Redirects, 404s and 5xx stop
   here.
2. **Blocked?** robots.txt (B.2) disallowing it; `noindex` in meta or
   `X-Robots-Tag` (B.3).
3. **Canonical** pointing elsewhere, or conflicting signals (4.5)?
4. **Search Console → URL Inspection**: "URL is not on Google" and the reason;
   "Test live URL" shows what Google renders — is the content there?
5. **Discovered or crawled?** Discovered → links and crawl budget (4.8, 10).
   Crawled, not indexed → value and duplication (7, 8).
6. **Linked?** In-content inbound links from indexed pages (B.5). In the sitemap
   (B.4)?
7. **Demand and authority**: a correct, unique page on a weak domain about a topic
   nobody searches can stay unindexed. That is not a bug.

### 18.2 Traffic dropped

1. **Is it real?** Tracking changed? Search Console lag (~2 days)? Compare
   Search Console clicks with analytics organic sessions.
2. **Where?** Site-wide, one template, one country, one device, a few queries?
   Use B.10's per-template view.
3. **Which component?** Split clicks into impressions × CTR. Fewer impressions
   → ranking or indexing. Same impressions, lower CTR → SERP changes (an AI
   Overview, new features), snippets, or seasonality.
4. **When?** Match the date to the change log, known core/spam updates,
   seasonality, and data events.
5. **Technical checks** on the affected template: status, robots, canonical,
   `noindex`, rendering, redirects (Appendix B).
6. **Lost links?** Check referring domains for the affected pages.
7. Fix the cause you can prove; for core updates with no technical cause, the
   response is content quality over months, not a quick fix.

### 18.3 The wrong page ranks for a query

Typical: a broad page (a month, a category) ranks for a query a specific page
(a day, a product) answers better, or the homepage ranks for a product query.

1. Confirm the specific page is indexed and self-canonical.
2. Align its title and H1 with the query's exact phrasing.
3. Link to it from the broad page and related pages with anchor text matching the
   query (7.6, 10.2).
4. Make sure the broad page does not answer the specific query better than the
   specific page does.
5. Give it time; internal link changes take a recrawl or two.

### 18.4 Google ignores the canonical

Look for signals pointing the other way: internal links to the other variant,
sitemaps listing it, redirects, hreflang naming it, or pages that are not
actually duplicates. Make every signal agree.

### 18.5 Soft 404s reported

Fetch the example URLs with `curl -i`. Usual causes: not-found pages served with
200; empty categories or search results; redirects of removed pages to generic
destinations; thin pages Google judges as empty. Fix the status or add real
content (4.2, 3.5).

### 18.6 Rich results disappeared

Check whether the feature still exists (9.3 — FAQ and several others are gone),
whether the markup is still valid (Rich Results Test, enhancement reports),
whether there is a manual action, and whether quality or eligibility rules
changed (e.g. self-serving reviews).

### 18.7 Hosting usage or bill spike

Part 15.5.

### 18.8 Spam pages you did not create

Search `site:yourdomain.com` with spammy terms; check Search Console →
Security issues and the Pages report for sudden growth. Clean the compromise
first (patch, rotate credentials, remove injected files), return 404/410 for the
injected URLs, then use the Removals tool for urgent cases.

### 18.9 Strange 404 URLs in Search Console

`/$`, `/undefined`, `/null`, `/[object Object]`, `/{id}`, `/YYYY` — Google
extracts path-like strings from JavaScript, JSON and machine-readable files.
Check whether any **internal** source emits them: the rendered DOM (B.5), your
`llms.txt` or other text files, and structured data. If one does, fix it. If it
is only framework code, the 404 is correct: ignore it.

### 18.10 "Crawled – currently not indexed" is rising

Open the examples (16.3). Old or low-demand long-tail pages → normal, check
again in 4 weeks. Recent, hub or money pages → measure similarity (B.8) and
value, improve internal links to them, and consider consolidating.

---

## Part 19 — Site-type modules

Each module uses the same structure. Hybrid sites (a SaaS product with a blog
and docs, a shop with a content hub) apply the module for each section.

### 19.1 E-commerce

**Goal and KPIs.** Organic revenue and conversion rate by landing template;
clicks to category and product pages; share of products indexed; merchant
listing impressions.

**Pages that rank.** Category and subcategory pages (head and mid-tail terms),
demand-backed filter landing pages ("waterproof trail running shoes"), product
pages (model-specific queries), buying guides and comparisons.

**Architecture.**
- Product URLs independent of the category path (`/products/slug`), so a
  product in three categories has one URL.
- Breadcrumbs; categories no more than three levels deep.
- Faceted navigation handled per [3.4](#34-faceted-navigation-and-url-parameters);
  pagination per [3.3](#33-pagination); internal search results not crawlable.

**Technical must-dos.**
- Price, availability and the main product content in the server HTML, matching
  structured data and the Merchant Center feed.
- Variants: one URL per variant only when the variant is searched for on its own
  (a colour people search by name); otherwise one URL with a selector.
  Describe variants with `ProductGroup` + `hasVariant`.
- Out-of-stock and discontinued handling per [3.5](#35-empty-expired-and-closed-states).
- Image-heavy category grids: lazy-load below the fold, sized images, fast
  first row.

**Content.** Unique product descriptions — manufacturer copy is duplicated on
every reseller. Real photos, specification tables, sizing and compatibility
detail, genuine reviews. Category pages with guidance that helps choose, not a
keyword paragraph. Buying guides that link to categories and products.

**Structured data.** `Product` + `Offer` (price, currency, availability,
shipping details, return policy), `ProductGroup` for variants, `AggregateRating`
and `Review` from real customers, `BreadcrumbList`, `Organization` with
merchant return and shipping policies. Submit a Merchant Center feed for free
listings.

**Authority.** Brand collaborations, press and gift guides, creator reviews
(`rel="sponsored"` when paid), original data about your market.

**Traps.** Facet URL explosions; tag pages; thin categories with one or two
items; redirecting every discontinued product to the homepage; reviews loaded
only by JavaScript; platform-generated alternate paths (for example
`/collections/x/products/y`) linked instead of the canonical product URL; session
or tracking parameters in internal links.

### 19.2 SaaS and B2B software

**Goal and KPIs.** Sign-ups and demo requests from organic; visibility for
problem-aware ("how to reconcile invoices") and solution-aware ("invoice
reconciliation software") queries; growth in branded search.

**Pages that rank.** Feature pages, use-case and industry pages, "alternatives
to X" and "X vs Y" pages, integration pages, templates and examples galleries,
pricing, documentation and help center, glossary, free tools.

**Architecture.** Marketing site server-rendered or static; the application on
its own subdomain behind login. Documentation and help in a subfolder (`/docs`)
where possible so they share the domain's authority.

**Technical must-dos.**
- The marketing site must not be a client-rendered single-page app — this is the
  classic SaaS failure ([19.9](#199-web-apps-and-single-page-applications)).
- Application URLs out of sitemaps; crawlers kept out of login redirects.
- Publicly shareable app pages (reports, boards, documents): `noindex` by default
  unless intentionally public and valuable — user content and privacy risk.
- Gated PDFs are invisible to search; publish an HTML version or summary.

**Content.** Organise around the jobs customers hire the product for. Integration
pages with real specifics (what syncs, setup steps, limits) — a template with
the partner's name substituted is thin. Comparison pages that are honest,
including where a competitor is better. Customer stories with concrete numbers.
Documentation written for the exact error messages and tasks people search.

**Structured data.** `SoftwareApplication` (with offers and ratings only if
real), `Organization`, `BreadcrumbList`, `VideoObject` for demos.

**Authority.** Integration marketplaces and partner directories, review
platforms, open-source tools, benchmarks and original research, free tools,
templates others reuse.

**Traps.** Hundreds of "{competitor} alternative" pages with no substance;
"best X software" listicles ranking yourself first — explicitly a spam concern
for AI answers since May 2026 ([14.7](#147-do-not-try-to-manipulate-ai-answers));
versioned docs competing with each other ([19.8](#198-documentation-and-developer-portals)).

### 19.3 Content publishers, blogs and affiliate sites

**Goal and KPIs.** Organic sessions to articles, engagement, returning readers,
newsletter sign-ups, revenue per session; share of articles indexed.

**Pages that rank.** In-depth guides, topic hub pages, reviews, comparisons,
how-tos.

**Architecture.** Topic clusters: a hub per topic linking every article in it,
articles linking back and across. A small set of meaningful categories rather
than hundreds of tags. Author pages. Date archives unlinked or `noindex`.

**Technical must-dos.** Tag, date and author archives that are thin: `noindex`
or consolidate. Ad slots with reserved space (CLS). Images sized and compressed.

**Content.** Reviews backed by first-hand testing: measurements, original
photos, pros and cons, comparison with alternatives. Consolidate overlapping
posts ([7.5](#75-prune-and-consolidate-with-data)). A review schedule for evergreen pieces. Affiliate
disclosure on the page; affiliate links `rel="sponsored"`.

**Structured data.** `Article`/`BlogPosting` with an author `Person` that has a
URL, `BreadcrumbList`, `Review` where it meets the requirements, `VideoObject`.

**Authority.** Original research, expert contributors, a newsletter, being the
source journalists quote.

**Traps.** Affiliate pages that restate manufacturer specs; mass-produced AI
articles ([7.3](#73-ai-assisted-content)); **site reputation abuse** — hosting
third-party coupon, casino or loan content under a trusted domain; titles with
last year's date.

### 19.4 News publishers

**Goal and KPIs.** Top Stories, Google News and Discover impressions and clicks;
time from publication to indexing; subscriptions.

**Pages that rank.** Articles, live coverage, topic hubs for developing stories,
author pages.

**Technical must-dos.**
- A **news sitemap** (articles from the last two days, up to 1,000 URLs) plus
  IndexNow for Bing.
- **Stable URLs**: never change the URL when the headline is updated.
- Honest `dateModified`; visible update notes for substantive changes.
- Paywalls marked up (`isAccessibleForFree`, `hasPart`) so they are not treated
  as cloaking.
- Syndicated copies point a canonical at the original.
- Large images (at least 1,200 px wide) and `max-image-preview:large` for
  Discover. AMP is not required.

**Content.** Original reporting, bylines with author pages, datelines, a
corrections policy, transparent ownership. Inclusion in Google News is
automatic under its content policies; there is no application.

**Structured data.** `NewsArticle` with headline, images, `datePublished`,
`dateModified`, author, publisher logo.

**Traps.** Wire copy republished without added value; clickbait in Discover;
thousands of thin tag pages; URLs that change with headlines.

### 19.5 Local and multi-location businesses

**Goal and KPIs.** Business profile actions (calls, direction requests, website
visits); local pack visibility per location; location-page sessions and
conversions.

**Pages that rank.** The business profile itself, the homepage, one page per
service, and one page per **real** location.

**Business profile.** The primary category is the most important choice. Exact
hours including holidays, services, photos, posts, answered questions. For
multiple locations, link each profile to its own location page, not the
homepage. Google describes local ranking as **relevance, distance and
prominence**.

**Consistency.** Name, address and phone identical on the site, the profile,
structured data and directories. With call tracking, use the tracking number as
primary and the main number as an additional number.

**Location pages.** Unique content per location: address, hours, staff, local
photos, directions and parking, services offered there, reviews from that
location, an embedded map, click-to-call. `LocalBusiness` (or a subtype) per
page, matching the profile.

**Reviews.** Ask every customer — asking only happy ones ("review gating")
violates the policies. Respond to reviews. Never incentivize or fabricate.

**Service-area businesses.** Hide the address if customers do not visit the
premises. Never use virtual offices or fake addresses — profiles get suspended.

**Traps.** **Doorway pages**: city pages differing only by the city name (spam
policy); keywords stuffed into the business name (policy violation); duplicate
profiles for one location; inconsistent phone numbers.

### 19.6 Marketplaces, directories and listings

Covers classifieds, jobs, real estate, travel listings, business directories,
event listings.

**Goal and KPIs.** Share of listings indexed; clicks to listing and category ×
location pages; leads or applications from organic.

**Pages that rank.** Category pages, category × location pages with demand,
individual listings, seller or agent profiles, guides.

**Technical must-dos.**
- An explicit index policy by listing quality — minimum fields, photos,
  description length — with thin listings `noindex` ([8.4](#84-an-explicit-index-policy-per-tier)).
- Expired listings handled per [3.5](#35-empty-expired-and-closed-states); for jobs, `validThrough` and the Indexing
  API to remove or update postings.
- Faceted navigation and pagination under control; duplicate listings from
  several sources consolidated with canonicals.
- Sitemaps split by segment and status, with honest `lastmod`.
- At this scale crawl budget and hosting cost are real constraints (4.8, 15).

**Content.** Enrich listings with data nobody else combines: local statistics,
comparable listings, price history, verified details. Category pages with
genuine guidance.

**Structured data.** `JobPosting`, `Event`, `Product`/`Offer` where applicable,
`LocalBusiness` for directory entries, `BreadcrumbList`.

**Traps.** Millions of empty category × location combinations; scraped
duplicate listings; stale listings still indexed; spam submissions; hosting
unrelated third-party sections (site reputation abuse).

### 19.7 Data, tools and programmatic sites

Calculators, converters, price and statistics sites, rankings, lookup tools,
dated archives.

**Goal and KPIs.** Long-tail clicks per template; share of each template
indexed; citations in AI answers; links earned by data and APIs.

**Pages that rank.** Tool pages; per-entity, per-date or per-combination data
pages; hubs; a methodology page; API documentation.

**Technical must-dos.**
- Prerender large page sets at build time rather than rendering on demand, if
  the host bills per render or cache write ([15.4](#154-what-your-host-meters)).
- Serialize only the data each component draws ([11.3](#113-page-weight-is-a-cost-not-just-a-speed-problem)).
- Explicit states for combinations with no data ([3.5](#35-empty-expired-and-closed-states), [8.4](#84-an-explicit-index-policy-per-tier)).
- "Today" pages dated in the title and content, so the snippet cannot look stale.
- Honest `lastmod`; IndexNow only for pages whose data changed.

**Content and data honesty.**
- Templates that differ by what the data shows ([8.3](#83-how-to-make-pages-genuinely-different)).
- Describe coverage exactly: "Since 2000", not "all time"; say how dense the
  data is.
- **Distinguish zero from unknown.** A provider's placeholder is not data: a
  quote API that returns "0.00% change" when it has no history must not render
  as "the price did not move".
- Show the anchor date behind computed figures ("1-year change, from the close
  on 22 September 2025").
- Publish measured accuracy for any forecast ([14.3](#143-publish-measured-uncertainty)).

**Structured data.** `Dataset`, `WebApplication` or `SoftwareApplication` for
tools, `BreadcrumbList`.

**Authority.** A free, documented API and downloadable datasets submitted to
directories; embeddable widgets with an attribution link; being the source
journalists cite.

**Traps.** Answers taken by AI Overviews and data boxes (plan for citations as
well as clicks); near-duplicate templates; empty combinations; crawl costs of
huge archives; charts shipping full histories; a broader page (a month)
ranking instead of the specific one (a day) ([18.3](#183-the-wrong-page-ranks-for-a-query)).

### 19.8 Documentation and developer portals

**Goal and KPIs.** Documentation traffic; rankings for exact error messages and
tasks; sign-ups and activations from docs; support deflection; referrals from AI
coding assistants.

**Pages that rank.** Getting-started guides, how-to guides, API reference,
troubleshooting pages titled with the exact error text, examples, changelog.

**Technical must-dos.**
- Static or server-rendered docs; code samples as text, never images.
- **Versions**: one stable "latest" URL per page; older versions canonical to
  the latest equivalent or `noindex`, so v1 does not outrank v3.
- Stable heading anchors; docs search results not crawlable.
- Publish the OpenAPI spec. Consider `llms.txt` and plain Markdown versions of
  pages — coding assistants fetch them ([14.6](#146-llmstxt)).

**Authority.** The GitHub repository, answers on Q&A sites that link to docs,
tutorials by others, awesome lists, package registry pages.

**Traps.** Old versions ranking; docs on a separate domain that never gains
authority; client-rendered reference pages; auto-generated reference pages with
no descriptions.

### 19.9 Web apps and single-page applications

**Goal and KPIs.** Sign-ups; indexed public pages.

**Pages that rank.** The marketing pages, and public pages people share
(profiles, templates, published documents) if you choose to make them indexable.

**Technical must-dos.**
- Server-render or pre-render every public route.
- Real 404 status for unknown routes — not `index.html` with 200.
- Unique `<title>`, description, canonical and social tags per route, set on the
  server. Social-network preview crawlers do not run JavaScript.
- `<a href>` links; no hash routing for content.
- Private and logged-in routes out of sitemaps; do not let private content
  become reachable without authentication.

**Traps.** Every route returning 200 with the same shell; one title for the
whole app; content only after login; broken link previews.

### 19.10 Communities, forums and UGC

**Goal and KPIs.** Indexed threads with useful answers; clicks to threads;
contributions from search visitors.

**Pages that rank.** Threads and Q&A pages, topic hubs; occasionally profiles.

**Technical must-dos.** `DiscussionForumPosting` or `QAPage` markup; one
canonical per thread with proper pagination; `noindex` empty threads and thin
profiles until they have content; `rel="ugc"` on user links; anti-spam controls
and rate limits. Content shown to crawlers must be shown to users; a login wall
for users only is cloaking.

**Traps.** Spam profiles indexed; duplicate threads; unmoderated sections used
for parasite content (site reputation abuse); infinite user-created tag pages.

### 19.11 Portfolios, personal brands and small business sites

**Goal and KPIs.** Owning the results for your name; enquiries; rankings for
"service + city" or "name + service".

**Pages that rank.** Home, about (who you are, credentials, proof), **one page
per service**, detailed case studies, contact. A blog only if it will be
maintained.

**Technical must-dos.** Fast static pages on your own domain, not a platform
subdomain; `Person` or `Organization` with `sameAs` to your real profiles;
`LocalBusiness` and a business profile if you serve a local area; check that no
template "hide from search engines" setting is still on.

**Brand results.** Use the same name, photo and description on every profile
(LinkedIn, GitHub, portfolio sites, social). Consistency is what lets search
engines connect them into one entity.

**Traps.** Everything on one long page, so nothing can rank for a specific
service; text inside images; case studies with no detail; leftover demo content
from a template.

---

## Part 20 — Things that stopped working, and myths

Do not spend effort on these, and do not accept them as justification for work.

| Tactic or belief | Reality |
|---|---|
| FAQ and HowTo rich results | Gone (HowTo 2023; FAQ limited 2023, removed May 2026) — 9.3 |
| Sitelinks search box markup | Removed November 2024 |
| Seven more rich result types | Retired June 2025 — 9.3 |
| Breadcrumbs shown on mobile results | Removed January 2025 (desktop still shows them) |
| `<meta name="keywords">`, keyword density | Ignored for decades |
| Word-count targets | Never a factor; completeness and originality are |
| Exact-match domains | No special benefit |
| Expired-domain redirects, PBNs, link exchanges, paid links without `sponsored` | Spam policies |
| Mass-produced AI or spun articles | Scaled content abuse |
| `priority` and `changefreq` in sitemaps | Ignored by Google |
| Sitemap ping endpoint | Deprecated 2023; no longer works |
| `rel="next"`/`rel="prev"` for Google | Unused since 2019 |
| `noindex` or `crawl-delay` in robots.txt for Google | Unsupported (Bing honours `crawl-delay`) |
| Search Console URL Parameters tool, crawl-rate limiter | Removed (2022, January 2024) |
| AMP required for Top Stories | Not since 2021 |
| Indexing API for any content | Only job postings and livestreams — 5.4 |
| Disavowing links routinely | Only after manual actions or known paid links |
| "Core Web Vitals are a major ranking factor" | Mostly a tie-breaker; they matter for users and conversions |
| "The good LCP threshold is now 2.0 s" | Still 2.5 s (web.dev, 2026) |
| "llms.txt improves rankings" | No search engine has said it uses it |
| "Blocking Google-Extended removes you from AI Overviews" | It does not; AI Overviews are part of Search |
| "More pages means more traffic" | Only when each page has demand and unique value |
| Third-party "authority" scores as truth | Vendor estimates from their own crawls |

---

## Appendix A — Rendering modes and framework traps

### A.1 Rendering modes

| Mode | Content in first HTML | SEO | Cost profile |
|---|---|---|---|
| Static generation (SSG) at build | Yes | Best | Build time grows with page count; each deploy may purge caches |
| Incremental / on-demand static (ISR) | Yes | Good | Cache writes on generation and revalidation, reads on cache misses |
| Server rendering per request (SSR) | Yes | Good | Compute on every uncached request |
| Streaming SSR | Shell first, content later in the same response | Good for crawlers that wait; audit the rendered DOM | As SSR |
| Client-side rendering (SPA) | No | Risky: slow or no indexing, soft 404s, no link previews | Cheap to host, expensive in lost visibility |
| Islands (static HTML, interactive parts hydrated) | Yes | Best | Small JavaScript |

Default choice for anything that should rank: static or incremental generation,
with client-side interactivity in small leaf components.

### A.2 Next.js (App Router) — verified traps

1. **Closed parameter sets need `export const dynamicParams = false`.** Without
   it, `notFound()` in a dynamic page can produce a 200 response carrying the
   not-found body — a soft 404, including in prerendered output.
2. **With `dynamicParams = false`, legacy URL formats 404 before the page
   runs.** A redirect written inside the page never executes. Put legacy
   redirects in `next.config` `redirects()` (or middleware) — see 3.6.
3. **`redirect()` answers 307 (temporary).** Use `permanentRedirect()` (308) or
   `redirects()` with `permanent: true` (308) for moved content.
4. **Route segment config must be declared literally in each route file.**
   Re-exporting `dynamicParams` or `revalidate` from a shared module silently
   does nothing.
5. **The shortest revalidation interval wins.** A route's `revalidate`, and any
   `fetch` or `unstable_cache` revalidate inside it, combine to the minimum. One
   data helper with an 8-hour timer made "never revalidate" pages regenerate
   around the clock.
6. **`generateStaticParams` runs at build only.** With `dynamicParams = false`, a
   newly valid parameter 404s until the next deploy.
7. **Convention-based `opengraph-image` is suppressed** on routes whose metadata
   declares `openGraph` without an image (6.5).
8. **Links prefetch in the viewport by default** in production. Use
   `prefetch={false}` on links into large long-tail sets (10.4).
9. **Client component props are serialized into the HTML.** Pass only what the
   component renders (11.3).
10. **`hrefLang`, not `hreflang`,** in emitted HTML — match case-insensitively.
11. **`<html lang>` comes from the root layout.** Localized sections need a
    layout that sets `lang` from the route (for example `app/[lang]/layout.tsx`),
    or every translated page is declared English (6.7).
12. **Metadata may be streamed.** Recent versions can send `generateMetadata`
    output after the initial HTML to browsers and JavaScript-running crawlers,
    and in the `<head>` to a list of HTML-only bots. If a raw-HTML audit finds
    titles or canonicals missing, re-run it rendered (`RENDER=1` in B.3) before
    concluding.
13. **Client boundaries:** keep interactive parts as small leaves so the
    surrounding content stays server-rendered.

### A.3 Other stacks — what to check

| Stack | Check |
|---|---|
| Nuxt | SSR on (the default); prerender large static sets (`routeRules` / Nitro prerender); `throw createError({ statusCode: 404 })` for unknown params; `useSeoMeta` per page |
| SvelteKit | `export const prerender = true` where possible; `error(404, …)` in `load` sets the status; per-page `<svelte:head>` |
| Astro | Static by default; `getStaticPaths` for dynamic routes; in server mode set 404 status explicitly |
| Remix / React Router | Throw a 404 response from the loader; `meta` export per route |
| Angular, React or Vue SPAs (Vite) | Client-rendered by default: add SSR or prerendering for public routes; serve real 404s |
| Gatsby | Static; watch build size and duplicate paginated or tag pages |
| WordPress | An SEO plugin for titles, canonicals and sitemaps; `noindex` thin tag, date and author archives; attachment pages redirected; plugin weight on performance; updates (hacked sites get spam injected) |
| Shopify | Fixed URL structure; link to canonical `/products/…` URLs rather than collection-scoped paths; robots.txt editable via `robots.txt.liquid`; filter URLs; app scripts slowing pages |
| Hosted builders (Webflow, Wix, Squarespace) | Custom domain as canonical (not the platform subdomain); redirect settings; per-page SEO fields; "hide from search engines" switches left on |

---

## Appendix B — Audit toolkit

Twelve scripts, each run against a real production build and against
deliberately broken input before being written down. How each was tested is
noted under it — re-run those checks if you modify a script.

### B.0 Setup

- **Node 18+** (built-in `fetch`) for the `.mjs` scripts.
- **Playwright** for B.5, B.8 and B.3 with `RENDER=1`:
  `npm i -D playwright && npx playwright install chromium`.
- **Python 3.8+**, standard library only, for B.10.
- **bash, curl, getent** for B.1 and B.11.
- Run against a **production build** (`npm run build && npm start`) or a
  staging deployment: `BASE=http://localhost:3000`. Scripts that read sitemaps
  rewrite listed URLs onto `BASE`, so a local build can be audited against a
  sitemap naming the production domain.
- Most scripts exit non-zero when they find problems, so they can run in CI.

### B.1 Status probe

Asserts status codes — including the 404s that must happen and the redirects that must exist.
*Tested:* Caught a legacy URL format returning 404 instead of redirecting on a production site, with valid siblings returning 200 in the same run.

`status-probe.sh`

```bash
#!/usr/bin/env bash
# status-probe.sh — assert HTTP status codes, including the ones that must FAIL.
# Usage: BASE=http://localhost:3000 ./status-probe.sh expectations.txt
# expectations.txt: "<status> <path>" per line, e.g.
#   200 /products/real-product      # a valid sibling, always test one
#   404 /products/not-a-product     # soft-404 check: must be a real 404
#   301 /old-url                    # redirects print their target
set -u
BASE="${BASE:?set BASE}"
fail=0
while read -r want path _; do
  [[ -z "${want:-}" || "$want" == \#* ]] && continue
  read -r got loc < <(curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE$path")
  if [[ "$got" == "$want" ]]; then mark=ok; else mark=FAIL; fail=1; fi
  printf '%-4s want %s got %s  %s%s\n' "$mark" "$want" "$got" "$path" "${loc:+  → $loc}"
done < "$1"
exit $fail
```

### B.2 robots.txt tester

Evaluates paths the way Google does (longest match, allow wins ties, per-crawler groups).
*Tested:* 15 tests, including all six precedence examples from Google's robots.txt documentation and its user-agent group example, plus a negative control showing a first-match parser gets one of Google's examples wrong. The tests follow.

`robots-check.mjs`

```js
// robots-check.mjs — test URLs against robots.txt the way Google evaluates it.
// Usage: node robots-check.mjs <robots.txt URL or file> <tokens> <path> [path ...]
//   <tokens> is the crawler's user-agent token list, most specific first, as
//   documented by the crawler's owner — e.g. Googlebot-Image,Googlebot
//   e.g. node robots-check.mjs https://example.com/robots.txt Googlebot / /search?q=x
// Google's rules (RFC 9309 + Google docs): one group applies per crawler (most
// specific user-agent; groups naming the same agent are merged; else `*`);
// within it the LONGEST matching path wins; on a tie, allow wins. `*` matches
// any run of characters, `$` anchors the end. Only the first 500 KiB is read.
// Python's urllib.robotparser uses first-match order instead — do not use it
// to predict Googlebot.
import { readFile } from 'node:fs/promises';

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.slice(0, 500 * 1024).split(/\r?\n/)) {
    const m = raw.replace(/#.*/, '').trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      // An empty Disallow means "nothing disallowed", so it adds no rule.
      if ((key === 'allow' || key === 'disallow') && current && value) {
        current.rules.push({ type: key, path: value });
      }
    }
  }
  return groups;
}

export function rulesFor(groups, tokens) {
  // Try each token in order (Googlebot-Image obeys a googlebot-image group,
  // else a googlebot group); groups naming the same token are merged; `*` last.
  for (const t of [...tokens.map((x) => x.toLowerCase()), '*']) {
    const chosen = groups.filter((g) => g.agents.includes(t));
    if (chosen.length) return chosen.flatMap((g) => g.rules);
  }
  return [];
}

function toRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

export function decide(rules, pathAndQuery) {
  if (pathAndQuery === '/robots.txt') return { allowed: true, rule: '(robots.txt is always fetchable)' };
  let best = null;
  for (const r of rules) {
    if (!toRegex(r.path).test(pathAndQuery)) continue;
    const len = r.path.length;
    if (!best || len > best.len || (len === best.len && r.type === 'allow')) best = { ...r, len };
  }
  return best
    ? { allowed: best.type === 'allow', rule: `${best.type}: ${best.path}` }
    : { allowed: true, rule: '(no rule matches)' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [src, tokens, ...paths] = process.argv.slice(2);
  if (!src || !tokens || !paths.length) {
    console.error('usage: node robots-check.mjs <robots.txt URL|file> <token[,fallback]> <path> [path ...]');
    process.exit(2);
  }
  const text = /^https?:/.test(src) ? await (await fetch(src)).text() : await readFile(src, 'utf8');
  const rules = rulesFor(parseRobots(text), tokens.split(','));
  let blocked = 0;
  for (const p of paths) {
    const { allowed, rule } = decide(rules, p);
    if (!allowed) blocked++;
    console.log(`${allowed ? 'ALLOW' : 'BLOCK'}  ${p.padEnd(40)} ${rule}`);
  }
  process.exit(blocked ? 1 : 0);
}
```

`robots-check.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, rulesFor, decide } from './robots-check.mjs';

// Vectors copied from Google's "Order of precedence for rules" table.
const google = [
  ['allow: /p\ndisallow: /', '/page', true],
  ['allow: /folder\ndisallow: /folder', '/folder/page', true],
  ['allow: /page\ndisallow: /*.htm', '/page.htm', false],
  ['allow: /page\ndisallow: /*.ph', '/page.php5', true],
  ['allow: /$\ndisallow: /', '/', true],
  ['allow: /$\ndisallow: /', '/page.htm', false],
];
for (const [rules, path, allowed] of google) {
  test(`google precedence: ${rules.replace('\n', ' + ')} on ${path}`, () => {
    const r = rulesFor(parseRobots(`user-agent: *\n${rules}`), ['Googlebot']);
    assert.equal(decide(r, path).allowed, allowed);
  });
}

// Google's user-agent group example: news / * / googlebot.
const groups = parseRobots('user-agent: googlebot-news\ndisallow: /news-only\n\nuser-agent: *\ndisallow: /star-only\n\nuser-agent: googlebot\ndisallow: /googlebot-only\n');
test('Googlebot-News follows its own group', () =>
  assert.deepEqual(rulesFor(groups, ['Googlebot-News', 'Googlebot']).map((r) => r.path), ['/news-only']));
test('Googlebot follows the googlebot group, not *', () =>
  assert.deepEqual(rulesFor(groups, ['Googlebot']).map((r) => r.path), ['/googlebot-only']));
test('Storebot-Google has no group of its own and follows *', () =>
  assert.deepEqual(rulesFor(groups, ['Storebot-Google']).map((r) => r.path), ['/star-only']));
test('Googlebot-Image falls back to googlebot, not *', () =>
  assert.deepEqual(rulesFor(groups, ['Googlebot-Image', 'Googlebot']).map((r) => r.path), ['/googlebot-only']));

test('stacked user-agent lines form one group', () => {
  const g = parseRobots('User-Agent: PetalBot\nUser-Agent: SemrushBot\nDisallow: /\n\nUser-Agent: *\nAllow: /\n');
  assert.equal(decide(rulesFor(g, ['SemrushBot']), '/x').allowed, false);
  assert.equal(decide(rulesFor(g, ['Googlebot']), '/x').allowed, true);
});
test('groups naming the same agent are merged', () => {
  const g = parseRobots('user-agent: a\ndisallow: /one\n\nuser-agent: b\ndisallow: /x\n\nuser-agent: a\ndisallow: /two\n');
  assert.deepEqual(rulesFor(g, ['a']).map((r) => r.path), ['/one', '/two']);
});
test('an empty Disallow allows everything', () =>
  assert.equal(decide(rulesFor(parseRobots('user-agent: *\ndisallow:\n'), ['x']), '/any').allowed, true));
test('query strings are part of the matched path', () => {
  const r = rulesFor(parseRobots('user-agent: *\ndisallow: /*?sort='), ['x']);
  assert.equal(decide(r, '/shoes?sort=price').allowed, false);
  assert.equal(decide(r, '/shoes').allowed, true);
});
test('negative control: first-match order would get Google\'s third vector wrong', () => {
  // A first-match parser sees "allow: /page" first and allows /page.htm.
  const rules = rulesFor(parseRobots('user-agent: *\nallow: /page\ndisallow: /*.htm'), ['x']);
  const firstMatch = rules.find((r) => new RegExp('^' + r.path.replace('*', '.*')).test('/page.htm'));
  assert.equal(firstMatch.type, 'allow');
  assert.equal(decide(rules, '/page.htm').allowed, false);
});
```

### B.3 Page audit

One row per template: status, title, description, canonical, robots, hreflang, H1, social image, structured data (including silently duplicated JSON keys), weight.
*Tested:* Duplicate-key detector: 6/6 hand-built cases (nested objects, escaped quotes, arrays). On a production build it flagged a noindex page and 404s, and passed valid pages.

`page-audit.mjs`

```js
// page-audit.mjs — one row per URL: status, title, description, canonical,
// robots, hreflang, social tags, H1s, structured data, HTML weight.
// Usage: BASE=http://localhost:3000 node page-audit.mjs /path-a /path-b ...
//   RENDER=1         read the rendered DOM via Playwright instead of raw HTML
//                    (needed when a framework streams head tags or content late)
//   BRAND_SUFFIX=" | Brand"  measure title length without the brand suffix
// Audit ONE representative URL per page template, on a production build.
const BASE = process.env.BASE ?? 'http://localhost:3000';
const SUFFIX = process.env.BRAND_SUFFIX ?? '';
const paths = process.argv.slice(2);
if (!paths.length) { console.error('usage: node page-audit.mjs /path [/path ...]'); process.exit(2); }

// Attributes of every <tag ...> of one kind, case-insensitive (React emits hrefLang).
const tags = (html, name) =>
  [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'gi'))].map(([, attrs]) =>
    Object.fromEntries([...attrs.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)]
      .map((m) => [m[1].toLowerCase(), m[3] ?? m[4]])));
const decode = (s = '') => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// JSON.parse keeps the LAST value of a duplicated key without warning; find them.
export function duplicateKeys(json) {
  const found = []; const stack = []; let i = 0;
  const readString = () => { let s = ''; i++; while (json[i] !== '"') { if (json[i] === '\\') { s += json[i] + json[i + 1]; i += 2; } else s += json[i++]; } i++; return s; };
  while (i < json.length) {
    const c = json[i];
    if (c === '{') { stack.push({ obj: true, keys: new Set(), expectKey: true }); i++; }
    else if (c === '[') { stack.push({ obj: false }); i++; }
    else if (c === '}' || c === ']') { stack.pop(); i++; }
    else if (c === ',') { const top = stack.at(-1); if (top?.obj) top.expectKey = true; i++; }
    else if (c === '"') {
      const top = stack.at(-1); const s = readString();
      if (top?.obj && top.expectKey) { if (top.keys.has(s)) found.push(s); top.keys.add(s); top.expectKey = false; }
    } else i++;
  }
  return found;
}

async function load(path) {
  if (!process.env.RENDER) {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location'), xRobots: res.headers.get('x-robots-tag'),
      html: res.status < 300 ? await res.text() : '' };
  }
  const { chromium } = await import('playwright');
  globalThis.browser ??= await chromium.launch();
  const page = await globalThis.browser.newPage();
  const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const out = { status: res.status(), location: null, xRobots: res.headers()['x-robots-tag'] ?? null, html: await page.content() };
  await page.close();
  return out;
}

const rows = []; const issues = [];
for (const path of paths) {
  const { status, location, xRobots, html } = await load(path);
  const flag = (msg) => issues.push(`${path}: ${msg}`);
  if (status !== 200) { flag(`HTTP ${status}${location ? ` → ${location}` : ''}`); rows.push({ path, status }); continue; }

  const head = html.split(/<\/head>/i)[0];
  const metas = tags(html, 'meta'); const links = tags(html, 'link');
  const meta = (k, v) => decode(metas.find((m) => m[k]?.toLowerCase() === v)?.content ?? '');
  const title = decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  const keywordPart = SUFFIX && title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : title;
  const description = meta('name', 'description');
  const canonicals = links.filter((l) => l.rel?.toLowerCase() === 'canonical');
  const robots = [meta('name', 'robots'), xRobots ?? ''].join(' ').toLowerCase();
  const hreflangs = links.filter((l) => l.rel?.toLowerCase() === 'alternate' && l.hreflang);
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  const types = new Set();
  for (const [, raw] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(raw);
      const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { if (n['@type']) [].concat(n['@type']).forEach((t) => types.add(t)); Object.values(n).forEach(walk); } };
      walk(data);
      for (const k of duplicateKeys(raw)) flag(`JSON-LD duplicate key "${k}" — the earlier value is silently discarded`);
    } catch (e) { flag(`JSON-LD does not parse: ${e.message}`); }
  }

  if (!title) flag('no <title>'); else if (keywordPart.length > 60) flag(`title ${keywordPart.length} chars before the brand suffix`);
  if (!description) flag('no meta description'); else if (description.length > 160) flag(`description ${description.length} chars`);
  if (canonicals.length !== 1) flag(`${canonicals.length} canonical tags`);
  else {
    const href = canonicals[0].href;
    if (!/^https?:\/\//.test(href)) flag(`canonical is relative: ${href}`);
    else if (new URL(href).pathname.replace(/\/$/, '') !== path.split('?')[0].replace(/\/$/, '')) flag(`canonical points elsewhere: ${href}`);
  }
  if (/noindex/.test(robots)) flag(`noindex (${robots.trim()})`);
  if (h1 !== 1) flag(`${h1} <h1> elements${process.env.RENDER ? '' : ' in raw HTML (re-check with RENDER=1)'}`);
  if (!meta('property', 'og:image')) flag('no og:image');
  if (!/<html[^>]*\blang=/i.test(html)) flag('no <html lang>');
  if (!metas.some((m) => m.name === 'viewport')) flag('no viewport meta');
  if (head.length === html.length) flag('no </head> found — malformed or fully client-rendered');

  rows.push({ path, status, title: keywordPart.length, desc: description.length, canonical: canonicals.length,
    noindex: /noindex/.test(robots), hreflang: hreflangs.length, h1, og: Boolean(meta('property', 'og:image')),
    schema: [...types].join(',').slice(0, 40), kb: Math.round(html.length / 1024) });
}
await globalThis.browser?.close();
console.table(rows);
console.log(issues.length ? `\n${issues.length} issue(s):\n  ${issues.join('\n  ')}` : '\nno issues');
process.exit(issues.length ? 1 : 0);
```

### B.4 Sitemap audit

File limits, duplicates, hosts, build-stamped or future `lastmod`, then status, canonical and noindex for a sample (or all) of the URLs.
*Tested:* Ran over a 13,738-URL sitemap. A seeded bad sitemap (duplicate URL, 96% identical lastmod, a future lastmod, 404s, a noindex page) had every defect reported.

`sitemap-audit.mjs`

```js
// sitemap-audit.mjs — structure of every sitemap file, then a status /
// canonical / noindex check of the URLs they list.
// Usage: BASE=http://localhost:3000 node sitemap-audit.mjs [/sitemap.xml | ./local-file.xml]
//   SAMPLE=200   URLs to fetch (0 = all). Always includes every URL under CHECK_PREFIXES.
//   CHECK_PREFIXES=/product/,/blog/   prefixes you changed this session — checked in full
// Listed URLs are rewritten onto BASE, so a local build can be audited against
// a sitemap that names the production domain.
import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SAMPLE = Number(process.env.SAMPLE ?? 200);
const PREFIXES = (process.env.CHECK_PREFIXES ?? '').split(',').filter(Boolean);
const start = process.argv[2] ?? '/sitemap.xml';
const local = (u) => { const x = new URL(u, BASE); return x.pathname + x.search; };
const problems = [];

async function readXml(path) {
  if (existsSync(path)) return readFileSync(path, 'utf8'); // audit a file before it ships
  const res = await fetch(BASE + local(path));
  if (!res.ok) { problems.push(`${path}: HTTP ${res.status}`); return ''; }
  const buf = Buffer.from(await res.arrayBuffer());
  const xml = (path.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
  if (buf.length > 50 * 1024 * 1024) problems.push(`${path}: ${buf.length} bytes, over the 50 MB limit`);
  return xml;
}

const entries = []; // { loc, lastmod, file }
async function walk(path) {
  const xml = await readXml(path);
  if (/<sitemapindex/i.test(xml)) {
    for (const [, loc] of xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>/gi)) await walk(loc);
    return;
  }
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map(([, b]) => ({
    loc: b.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1], lastmod: b.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1], file: path }));
  if (urls.length > 50000) problems.push(`${path}: ${urls.length} URLs, over the 50,000 limit`);
  console.log(`${path}: ${urls.length} URLs`);
  entries.push(...urls);
}
await walk(start);

// Structure checks — none of these need a single page fetch.
const hosts = new Set(entries.map((e) => new URL(e.loc).host));
if (hosts.size > 1) problems.push(`URLs span ${hosts.size} hosts: ${[...hosts].join(', ')}`);
const seen = new Map();
for (const e of entries) seen.set(e.loc, (seen.get(e.loc) ?? 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1);
if (dupes.length) problems.push(`${dupes.length} URLs listed more than once, e.g. ${dupes[0][0]}`);
const stamps = entries.map((e) => e.lastmod).filter(Boolean);
if (stamps.length) {
  const counts = new Map(); for (const s of stamps) counts.set(s, (counts.get(s) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (stamps.length > 20 && n / stamps.length > 0.5)
    problems.push(`${Math.round((100 * n) / stamps.length)}% of lastmod values are identical (${top}) — looks stamped at build time, not when content changed`);
  const future = stamps.filter((s) => Date.parse(s) > Date.now() + 864e5);
  if (future.length) problems.push(`${future.length} lastmod values are in the future`);
  const bad = stamps.filter((s) => Number.isNaN(Date.parse(s)));
  if (bad.length) problems.push(`${bad.length} lastmod values are not W3C dates, e.g. ${bad[0]}`);
}

// URL checks: every listed URL should be 200, self-canonical and indexable.
const must = entries.filter((e) => PREFIXES.some((p) => local(e.loc).startsWith(p)));
const rest = entries.filter((e) => !must.includes(e));
// An even spread across the list, so every section of a large sitemap is represented.
const spread = SAMPLE === 0 || rest.length <= SAMPLE ? rest
  : Array.from({ length: SAMPLE }, (_, k) => rest[Math.floor((k * rest.length) / SAMPLE)]);
const picked = [...must, ...spread];
let bad = 0;
const check = async ({ loc }) => {
  const path = local(loc);
  const res = await fetch(BASE + path, { redirect: 'manual' });
  if (res.status !== 200) { bad++; problems.push(`${path}: HTTP ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`); return; }
  const html = await res.text();
  const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0].match(/href=["']([^"']+)/i)?.[1];
  if (canon && local(canon).replace(/\/$/, '') !== path.replace(/\/$/, '')) { bad++; problems.push(`${path}: canonical points to ${canon}`); }
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html) || /noindex/i.test(res.headers.get('x-robots-tag') ?? '')) { bad++; problems.push(`${path}: listed but noindex`); }
};
for (let i = 0; i < picked.length; i += 8) await Promise.all(picked.slice(i, i + 8).map(check));

console.log(`\n${entries.length} URLs listed; ${picked.length} fetched; ${bad} failed a URL check`);
console.log(problems.length ? `\n${problems.length} problem(s):\n  ${problems.slice(0, 50).join('\n  ')}` : 'no problems');
process.exit(problems.length ? 1 : 0);
```

### B.5 Rendered link graph

Crawls the rendered site like a bot: click depth, in-content inbound links, broken links, orphans and pages missing from the sitemap.
*Tested:* A synthetic site with known answers (an orphan, a page linked only from the header, trailing-slash and #fragment variants, a 404) produced exactly the expected graph. Blocking third-party requests and media cut a 40-page real crawl from 3 min 23 s to 7 s with identical results.

`link-graph.mjs`

```js
// link-graph.mjs — crawl the RENDERED site like a bot: click depth, in-content
// inbound links per page, and orphans (in the sitemap, never reached by links).
// Usage: BASE=http://localhost:3000 node link-graph.mjs
//   MAX=300         pages to render (orphan results are only valid if the crawl completes)
//   SITEMAP=/sitemap.xml   set to '' to skip the orphan comparison
//   KEEP_QUERY=1    treat ?a=1 as a distinct URL (default: strip queries)
// Writes link-graph.csv. Header/footer/nav links are excluded from inbound
// counts: they appear on every page and would hide the real structure.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = new URL(process.env.BASE ?? 'http://localhost:3000');
const MAX = Number(process.env.MAX ?? 300);
const SITEMAP = process.env.SITEMAP ?? '/sitemap.xml';
const SKIP = /\.(pdf|jpe?g|png|gif|webp|avif|svg|xml|txt|json|csv|zip|mp4|ico)$/i;

const norm = (href) => {
  const u = new URL(href, BASE);
  if (u.origin !== BASE.origin || SKIP.test(u.pathname)) return null;
  const path = u.pathname.replace(/\/+$/, '') || '/';
  return process.env.KEEP_QUERY ? path + u.search : path;
};

const depth = new Map([['/', 0]]);
const inbound = new Map();          // page -> Set of pages linking to it from content
const status = new Map();
const queue = ['/'];

const browser = await chromium.launch();
let inFlight = 0;
const worker = async () => {
  const page = await browser.newPage();
  // Links come from first-party HTML and scripts. Third-party tags and media
  // only slow each render (analytics can hold "network idle" open for seconds).
  await page.route('**/*', (route) => {
    const req = route.request();
    const firstParty = new URL(req.url()).origin === BASE.origin;
    return firstParty && !['image', 'media', 'font'].includes(req.resourceType()) ? route.continue() : route.abort();
  });
  while (status.size < MAX) {
    // An empty queue is only the end if no other worker is still rendering a
    // page that may add more; otherwise wait for it.
    if (!queue.length) { if (!inFlight) break; await new Promise((r) => setTimeout(r, 50)); continue; }
    const path = queue.shift();
    if (status.has(path)) continue;
    status.set(path, 'pending');
    inFlight++;
    try {
      const res = await page.goto(new URL(path, BASE).href, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(300); // let streamed content and client-rendered links settle
      status.set(path, res?.status() ?? 0);
      const { content, all } = await page.evaluate(() => {
        const region = document.querySelector('main, [role="main"], article');
        const anchors = [...document.querySelectorAll('a[href]')];
        const inRegion = region
          ? [...region.querySelectorAll('a[href]')]
          : anchors.filter((a) => !a.closest('header, footer, nav, aside'));
        return { content: inRegion.map((a) => a.href), all: anchors.map((a) => a.href) };
      });
      for (const target of new Set(content.map(norm).filter(Boolean))) {
        if (target === path) continue;
        if (!inbound.has(target)) inbound.set(target, new Set());
        inbound.get(target).add(path);
      }
      for (const target of new Set(all.map(norm).filter(Boolean))) {
        const d = depth.get(path) + 1;
        if (!depth.has(target)) { depth.set(target, d); queue.push(target); }
        else if (d < depth.get(target)) depth.set(target, d); // parallel workers can find a longer path first
      }
    } catch (e) { status.set(path, `error: ${e.message.split('\n')[0]}`); }
    inFlight--;
  }
  await page.close();
};
await Promise.all(Array.from({ length: 4 }, worker));
await browser.close();

const crawled = [...status.keys()];
const complete = queue.every((p) => status.has(p)) && status.size < MAX;
console.log(`rendered ${crawled.length} pages; crawl ${complete ? 'COMPLETE' : `stopped at MAX=${MAX} with ${queue.length} URLs unvisited`}`);

const hist = {};
for (const p of crawled) hist[depth.get(p)] = (hist[depth.get(p)] ?? 0) + 1;
console.log('pages by click depth from the homepage:', hist);
const deep = crawled.filter((p) => depth.get(p) > 3);
if (deep.length) console.log(`${deep.length} pages deeper than 3 clicks, e.g. ${deep.slice(0, 3).join(', ')}`);

const rows = crawled.map((p) => ({ path: p, status: status.get(p), depth: depth.get(p), inbound: inbound.get(p)?.size ?? 0 }));
const weak = rows.filter((r) => r.status === 200 && r.path !== '/' && r.inbound <= 1).sort((a, b) => a.inbound - b.inbound);
console.log(`\n${weak.length} crawled pages with ≤1 in-content inbound link:`);
for (const r of weak.slice(0, 15)) console.log(`  in=${r.inbound}  depth=${r.depth}  ${r.path}`);
const broken = rows.filter((r) => r.status !== 200);
if (broken.length) console.log(`\n${broken.length} linked URLs not returning 200:\n  ${broken.slice(0, 15).map((r) => `${r.status}  ${r.path}`).join('\n  ')}`);

if (SITEMAP) {
  const xml = await fetch(new URL(SITEMAP, BASE)).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  const listed = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(([, u]) => norm(new URL(new URL(u).pathname + new URL(u).search, BASE).href)).filter(Boolean);
  const reached = new Set(depth.keys());
  const orphans = listed.filter((u) => !reached.has(u));
  const unlisted = crawled.filter((p) => status.get(p) === 200 && !listed.includes(p));
  if (!complete) console.log(`\n(orphan check skipped: raise MAX until the crawl completes — ${listed.length} URLs in the sitemap)`);
  else {
    console.log(`\n${orphans.length} sitemap URLs no link reaches (orphans)${orphans.length ? ':\n  ' + orphans.slice(0, 15).join('\n  ') : ''}`);
    console.log(`${unlisted.length} reachable 200 pages missing from the sitemap${unlisted.length ? ':\n  ' + unlisted.slice(0, 15).join('\n  ') : ''}`);
  }
}
writeFileSync('link-graph.csv', 'path,status,depth,inbound\n' + rows.map((r) => `${r.path},${r.status},${r.depth},${r.inbound}`).join('\n'));
console.log('\nwrote link-graph.csv');
```

### B.6 Page weight

HTML size, compressed size, share of inline script/data, and repeated data keys that reveal serialized series.
*Tested:* A synthetic page embedding a 6,500-point series split over 13 script tags (as streaming frameworks do) was flagged; React markup keys (`children`, `className`) no longer trigger false alarms.

`page-weight.mjs`

```js
// page-weight.mjs — how heavy each page's HTML is, and how much of it is
// serialized data (hydration payloads, inline state) rather than markup.
// Usage: BASE=http://localhost:3000 node page-weight.mjs /path [/path ...]
//   BUDGET_KB=150   flag HTML above this (uncompressed)
//   UNIT_KB=8       if your host bills cache reads per N KB, show units per request
// Why uncompressed: hosts that meter cache/ISR reads or origin transfer
// usually count stored bytes, and parse/hydration cost scales with them too.
import { gzipSync } from 'node:zlib';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const BUDGET = Number(process.env.BUDGET_KB ?? 150) * 1024;
const UNIT = process.env.UNIT_KB ? Number(process.env.UNIT_KB) * 1024 : 0;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
// Keys that describe markup, not data — React/Vue/Svelte trees repeat these by the thousand.
const MARKUP = new Set(['children', 'className', 'class', 'style', 'href', 'src', 'alt', 'id', 'key', 'ref', 'type',
  'role', 'rel', 'content', 'name', 'title', 'lang', 'prefetch', 'target', 'width', 'height', 'fill', 'd', 'viewBox',
  'stroke', 'strokeWidth', 'xmlns', 'as', 'crossOrigin', 'dangerouslySetInnerHTML', '__html', 'aria-hidden', 'tabIndex']);
const flagged = [];
const rows = [];

for (const path of process.argv.slice(2)) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  const bytes = Buffer.byteLength(html);
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/application\/ld\+json/i.test(attrs)) // structured data is wanted
    .map(([, , body]) => body);
  const inlineBytes = inline.reduce((n, s) => n + Buffer.byteLength(s), 0);
  const largest = [...inline].sort((a, b) => b.length - a.length)[0] ?? '';
  // Count keys across ALL inline scripts: streaming frameworks (React Server
  // Components, etc.) split one payload over many small <script> tags.
  const keyCounts = {};
  for (const [, k] of inline.join('').matchAll(/\\?"([A-Za-z_][\w]{1,30})\\?":/g)) if (!MARKUP.has(k)) keyCounts[k] = (keyCounts[k] ?? 0) + 1;
  const [topKey, topCount = 0] = Object.entries(keyCounts).sort((a, b) => b[1] - a[1])[0] ?? [];
  const share = inlineBytes / Math.max(bytes, 1);
  rows.push({
    path, status: res.status, html: kb(bytes), gzip: kb(gzipSync(html).length),
    inlineData: `${Math.round(100 * share)}%`, largestScript: kb(Buffer.byteLength(largest)),
    repeatedKey: topCount >= 100 ? `"${topKey}" ×${topCount}` : '',
    ...(UNIT ? { units: Math.ceil(bytes / UNIT) } : {}),
  });
  if (bytes > BUDGET) flagged.push(`${path}: ${kb(bytes)} HTML, over the ${kb(BUDGET)} budget`);
  // Some inline data is normal: RSC-style frameworks ship the rendered tree
  // twice (HTML + payload), so ~50-60% is typical. Flag what goes beyond it.
  // A chart rarely draws more than a few hundred points per series, so thousands
  // of records usually mean a component received everything and drew a slice.
  if (topCount >= 3000)
    flagged.push(`${path}: "${topKey}" appears ${topCount}× — thousands of records serialized into the page; find the component that receives them and check how many it actually draws`);
  else if (share > 0.75 && bytes > 100 * 1024)
    flagged.push(`${path}: ${Math.round(100 * share)}% of the HTML is inline script/data`);
}
console.table(rows);
console.log(flagged.length ? `\n${flagged.join('\n')}` : '\nall within budget');
process.exit(flagged.length ? 1 : 0);
```

### B.7 hreflang clusters

Expands each cluster and checks completeness, reciprocity, self-reference, x-default, valid codes, `<html lang>` agreement and member health.
*Tested:* A seeded broken cluster (`en-UK`, members not listing each other, a noindex member) had every defect reported. On a real site it found translated pages declaring `<html lang="en">`.

`hreflang-check.mjs`

```js
// hreflang-check.mjs — expand every hreflang cluster reachable from the given
// pages and check it the way search engines do.
// Usage: BASE=http://localhost:3000 node hreflang-check.mjs /page [/page ...]
// Checks: self-reference, reciprocity (and matching codes both ways), exactly
// one x-default, valid codes, and that every member is 200, indexable and
// self-canonical. A cluster with a broken member can be ignored entirely.
const BASE = process.env.BASE ?? 'http://localhost:3000';
const local = (u) => { const x = new URL(u, BASE); return (x.pathname.replace(/\/+$/, '') || '/') + x.search; };
const CODE = /^(x-default|[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?)$/i;
const MISTAKES = { 'en-uk': 'en-GB', jp: 'ja', cn: 'zh', gr: 'el', se: 'sv', dk: 'da', cz: 'cs', kr: 'ko', vn: 'vi', ua: 'uk (Ukrainian)', 'zh-cn': 'zh-Hans or zh-CN (both valid)' };

const pages = new Map(); // path -> { status, noindex, canonical, alternates: Map(code -> path) }
async function load(path) {
  if (pages.has(path)) return pages.get(path);
  const res = await fetch(BASE + path, { redirect: 'manual' });
  const html = res.status === 200 ? await res.text() : '';
  const alternates = new Map();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=["']alternate["']/i.test(tag)) continue;
    const code = tag.match(/hreflang=["']([^"']+)/i)?.[1];   // React emits hrefLang: match case-insensitively
    const href = tag.match(/href=["']([^"']+)/i)?.[1];
    if (code && href) alternates.set(code, local(href));
  }
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0].match(/href=["']([^"']+)/i)?.[1];
  const info = { status: res.status, noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html),
    canonical: canonical ? local(canonical) : null, alternates,
    lang: (html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1] ?? '').toLowerCase() };
  pages.set(path, info);
  return info;
}

const problems = []; const clusters = new Set();
for (const start of process.argv.slice(2).map(local)) {
  const first = await load(start);
  if (!first.alternates.size) { console.log(`${start}: no hreflang`); continue; }
  // Breadth-first over the cluster, so members only reachable via another member are included.
  const members = new Set([start]); const todo = [start];
  while (todo.length) for (const p of (await load(todo.shift())).alternates.values()) if (!members.has(p)) { members.add(p); todo.push(p); }
  const key = [...members].sort().join(' ');
  if (clusters.has(key)) continue;
  clusters.add(key);
  console.log(`cluster: ${[...members].join(', ')}`);

  for (const p of members) {
    const info = await load(p);
    const say = (m) => problems.push(`${p}: ${m}`);
    if (info.status !== 200) { say(`HTTP ${info.status} — every hreflang target must return 200`); continue; }
    if (info.noindex) say('noindex — cluster members must be indexable');
    if (info.canonical && info.canonical !== p) say(`canonical points to ${info.canonical} — members must be self-canonical`);
    if (!info.alternates.size) { say('lists no alternates — reciprocity broken for everyone pointing here'); continue; }
    if (![...info.alternates.values()].includes(p)) say('does not list itself');
    const xd = [...info.alternates.keys()].filter((c) => c.toLowerCase() === 'x-default').length;
    if (xd === 0) say('no x-default (recommended)'); else if (xd > 1) say(`${xd} x-default entries`);
    // Every member must list every other member; a one-way pair is ignored.
    for (const q of members) if (q !== p && ![...info.alternates.values()].includes(q)) say(`does not list ${q}`);
    for (const [code, target] of info.alternates) {
      if (!CODE.test(code)) say(`invalid code "${code}"`);
      const fix = MISTAKES[code.toLowerCase()]; if (fix) say(`code "${code}" is probably wrong — use ${fix}`);
      if (target === p || code.toLowerCase() === 'x-default') continue;
      const other = await load(target);
      // The declared <html lang> and the hreflang code must name the same
      // language. When they disagree either may be wrong: a localized page
      // under a site-wide <html lang="en">, or "uk" (Ukrainian) meant as UK.
      const langOf = (c) => c.toLowerCase().split('-')[0];
      if (other.lang && langOf(other.lang) !== langOf(code))
        say(`calls ${target} "${code}" but that page declares <html lang="${other.lang}"> — fix whichever is wrong` +
          (langOf(code) === 'uk' ? ' ("uk" is Ukrainian; United Kingdom is en-GB)' : ''));
      // A page may carry several codes for itself (e.g. en and x-default).
      const selfCodes = [...other.alternates].filter(([, t]) => t === target).map(([c]) => c.toLowerCase());
      if (selfCodes.length && !selfCodes.includes(code.toLowerCase())) say(`calls ${target} "${code}" but it calls itself ${selfCodes.map((c) => `"${c}"`).join(' / ')}`);
    }
  }
}
console.log(problems.length ? `\n${problems.length} problem(s):\n  ${problems.join('\n  ')}` : '\nall clusters valid');
process.exit(problems.length ? 1 : 0);
```

### B.8 Template similarity

The subtraction test (8.2): median pairwise similarity of main content across pages of one template.
*Tested:* Control: the same page twice scores 100%. A real dated-archive template scored a 20.6% median — ruling out duplication as the reason its pages were not indexed.

`similarity.mjs`

```js
// similarity.mjs — the subtraction test: how alike are pages of ONE template
// once the shared chrome is stripped? Median pairwise Jaccard over word shingles.
// Usage: BASE=http://localhost:3000 node similarity.mjs /t/a /t/b /t/c ...  (15-30 URLs)
// Read the result as RELATIVE: re-run the same URLs with the same K after a
// change. With K=6 over >=300 words of main content, a median above ~90% means
// search engines will index a handful and treat the rest as duplicates.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const K = Number(process.env.K ?? 6);
const shingles = (text) => {
  const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + K <= w.length; i++) s.add(w.slice(i, i + K).join(' '));
  return s;
};
const jaccard = (a, b) => { let hit = 0; for (const x of a) if (b.has(x)) hit++; return hit / (a.size + b.size - hit); };

const browser = await chromium.launch();
const page = await browser.newPage();
const docs = [];
for (const path of process.argv.slice(2)) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const text = await page.locator('main, [role="main"], article').first().innerText().catch(() => '');
  const s = shingles(text);
  if (s.size === 0) { console.warn(`skipped (no main content or under ${K} words): ${path}`); continue; }
  docs.push({ path, s, words: text.split(/\s+/).length });
}
await browser.close();
if (docs.length < 2) { console.error('need at least 2 usable pages'); process.exit(1); }
const sims = [];
for (let i = 0; i < docs.length; i++) for (let j = i + 1; j < docs.length; j++) sims.push(jaccard(docs[i].s, docs[j].s));
sims.sort((x, y) => x - y);
const at = (q) => sims[Math.min(sims.length - 1, Math.floor(sims.length * q))];
const pct = (n) => `${(100 * n).toFixed(1)}%`;
console.log(`${docs.length} pages, ${sims.length} pairs, median ${Math.round(docs.map((d) => d.words).sort((a, b) => a - b)[docs.length >> 1])} words of main content`);
console.log(`median ${pct(at(0.5))}   p90 ${pct(at(0.9))}   max ${pct(sims.at(-1))}`);
```

### B.9 Redirect map

Verifies a migration map: permanent, one hop, exact target, target returns 200.
*Tested:* Seven synthetic cases with known answers (two correct; a 302, a two-hop chain, a wrong target, a 404 target, no redirect) were all classified correctly.

`redirect-check.mjs`

```js
// redirect-check.mjs — verify a migration's redirect map before and after launch.
// Usage: BASE=http://localhost:3000 node redirect-check.mjs redirects.csv
// redirects.csv: one "old,new" pair per line (paths or absolute URLs; # comments ok).
// Each old URL must answer 301 or 308 (permanent), in ONE hop, to exactly the
// new URL, and the new URL must answer 200. Temporary codes (302/307) and chains
// still pass users through, but consolidate signals slower and less reliably.
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const path = (u) => { const x = new URL(u, BASE); return x.pathname + x.search; };
const pairs = readFileSync(process.argv[2], 'utf8').split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => l.split(',').map((s) => s.trim()));

let failed = 0;
for (const [from, to] of pairs) {
  const hops = [];
  let url = path(from);
  for (let i = 0; i < 10; i++) {             // Googlebot follows up to 10 hops
    const res = await fetch(BASE + url, { redirect: 'manual' });
    hops.push({ url, status: res.status });
    const loc = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !loc) break;
    url = path(loc);
  }
  const first = hops[0]; const last = hops.at(-1);
  const problems = [];
  if (![301, 308].includes(first.status)) problems.push(first.status >= 300 && first.status < 400 ? `temporary ${first.status}` : `answers ${first.status}, not a redirect`);
  if (hops.length > 2) problems.push(`${hops.length - 1} hops: ${hops.map((h) => `${h.status} ${h.url}`).join(' → ')}`);
  if (hops.length > 1 && last.url !== path(to)) problems.push(`lands on ${last.url}, expected ${path(to)}`);
  if (hops.length > 1 && last.status !== 200) problems.push(`target answers ${last.status}`);
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${path(from)} → ${path(to)}${problems.length ? '   ' + problems.join('; ') : ''}`);
}
console.log(`\n${pairs.length - failed}/${pairs.length} redirects correct`);
process.exit(failed ? 1 : 0);
```

### B.10 Search Console report

Reads a Performance export (xlsx or CSV zip, any UI language) and prints equal-window comparisons, what the tables omit, striking-distance queries, dead top-10 queries and a per-template view.
*Tested:* Run on three real exports (24 hours hourly, 7 days, 28 days) and on a French-formatted CSV zip (`0,81 %` CTRs, decimal commas) built from the same data: identical totals.

`gsc-report.py`

```python
#!/usr/bin/env python3
"""gsc-report.py — read a Search Console Performance export and report what the
UI makes easy to misread. Standard library only.

Usage: python3 gsc-report.py export.xlsx            (Excel download)
       python3 gsc-report.py export.zip             (CSV download)
Options: --min-impressions 20   threshold for opportunity lists

Works in any UI language: sheets are found by position (xlsx) or by content
and file name (CSV), never by their localized titles.
"""
import csv, io, re, sys, zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
MIN_IMP = int(sys.argv[sys.argv.index('--min-impressions') + 1]) if '--min-impressions' in sys.argv else 20


def num(v):
    """'1,5 %', '0.81%', '0.0081', '1 234' -> float. CTR comes back as a fraction."""
    s = str(v).replace(' ', '').replace('\xa0', '').replace(' ', '').strip()
    pct = s.endswith('%')
    s = s.rstrip('%')
    if ',' in s and '.' not in s:
        s = s.replace(',', '.')
    s = s.replace(',', '')
    try:
        x = float(s)
    except ValueError:
        return 0.0
    return x / 100 if pct else x


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        shared = [''.join(t.text or '' for t in si.iter(NS + 't'))
                  for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(NS + 'si')]
    sheets = []
    for i in range(1, 50):
        name = f'xl/worksheets/sheet{i}.xml'
        if name not in z.namelist():
            break
        rows = []
        for r in ET.fromstring(z.read(name)).iter(NS + 'row'):
            vals = []
            for c in r:
                v, t = c.find(NS + 'v'), c.get('t')
                if t == 's':
                    vals.append(shared[int(v.text)])
                elif t == 'inlineStr':
                    vals.append(''.join(x.text or '' for x in c.iter(NS + 't')))
                else:
                    vals.append(v.text if v is not None else '')
            rows.append(vals)
        sheets.append(rows)
    # GSC always writes: chart, queries, pages, countries, devices, appearance, filters.
    return {'chart': sheets[0], 'queries': sheets[1], 'pages': sheets[2]}


def read_csv_zip(path):
    z = zipfile.ZipFile(path)
    found = {}
    for name in z.namelist():
        rows = list(csv.reader(io.StringIO(z.read(name).decode('utf-8-sig'))))
        if len(rows) < 2:
            continue
        first = [r[0] for r in rows[1:6] if r]
        low = name.lower()
        if all(re.match(r'\d{4}-\d{2}-\d{2}', v) for v in first):
            found['chart'] = rows
        elif all(v.startswith('http') for v in first):
            found['pages'] = rows
        elif re.search(r'quer|requ|consult|anfrag|zoek|domand', low):
            found['queries'] = rows
    return found


def table(rows):
    out = []
    for r in rows[1:]:
        if len(r) >= 5 and r[0]:
            out.append({'key': r[0], 'clicks': num(r[1]), 'imp': num(r[2]), 'ctr': num(r[3]), 'pos': num(r[4])})
    return out


def wpos(rows):
    imp = sum(r['imp'] for r in rows)
    return sum(r['pos'] * r['imp'] for r in rows) / imp if imp else 0.0


def summarize(label, rows):
    clicks = sum(r['clicks'] for r in rows)
    imp = sum(r['imp'] for r in rows)
    ctr = clicks / imp if imp else 0
    return f"{label:<22} clicks {clicks:>7.0f}  impressions {imp:>9.0f}  CTR {ctr:6.2%}  position {wpos(rows):5.1f}"


def main():
    path = next((a for a in sys.argv[1:] if not a.startswith('--') and not a.isdigit()), None)
    if not path:
        sys.exit(__doc__)
    data = read_xlsx(path) if path.endswith('.xlsx') else read_csv_zip(path)
    chart, queries, pages = (table(data.get(k, [])) for k in ('chart', 'queries', 'pages'))

    print('== totals ==')
    hourly = bool(chart) and 'T' in chart[0]['key']
    print(summarize(f"{len(chart)} {'hours' if hourly else 'days'}", chart))

    # Equal windows only: comparing a week against its single best day, or a
    # 7-day export against a 28-day one, manufactures trends.
    if not hourly and len(chart) >= 14:
        rows = sorted(chart, key=lambda r: r['key'])
        n = len(rows) // 2
        before, after = rows[-2 * n:-n], rows[-n:]
        print(f"\n== last {n} days vs the {n} before (equal windows) ==")
        print(summarize(f"{before[0]['key']}..{before[-1]['key']}", before))
        print(summarize(f"{after[0]['key']}..{after[-1]['key']}", after))
    elif not hourly:
        print('\n(fewer than 14 days — export a longer range before calling a trend)')

    total_clicks = sum(r['clicks'] for r in chart)
    print('\n== what the tables leave out ==')
    for name, rows in (('queries', queries), ('pages', pages)):
        shown = sum(r['clicks'] for r in rows)
        line = f"{name}: {len(rows)} rows carry {shown:.0f} of {total_clicks:.0f} clicks ({shown / total_clicks:.0%})" if total_clicks else f"{name}: {len(rows)} rows"
        if name == 'queries' and total_clicks and shown < 0.9 * total_clicks:
            line += ' — the rest come from queries Google anonymizes, so query-level totals always undercount'
        if total_clicks and shown > total_clicks:
            line += ' — page rows are aggregated by URL, the chart by site; small differences are normal'
        print(line)
        if len(rows) >= 1000:
            last = rows[-1]
            clicks = '0 clicks' if last['clicks'] == 0 else f"≤{last['clicks']:.0f} clicks"
            print(f"   capped at 1,000 rows. Rows are sorted by clicks, then impressions, so every omitted row has "
                  f"{clicks} and ≤{last['imp']:.0f} impressions. 'Absent' means small, not zero.")

    print(f"\n== striking distance: queries at position 8-20 with ≥{MIN_IMP} impressions ==")
    near = sorted((q for q in queries if 8 <= q['pos'] <= 20 and q['imp'] >= MIN_IMP), key=lambda q: -q['imp'])
    for q in near[:15]:
        print(f"  pos {q['pos']:5.1f}  imp {q['imp']:6.0f}  clicks {q['clicks']:3.0f}  {q['key']}")
    if not near:
        print('  none')

    print(f"\n== top-10 positions earning no clicks (≥{MIN_IMP} impressions): snippet, intent or SERP-feature problem ==")
    dead = sorted((q for q in queries if q['pos'] <= 10 and q['clicks'] == 0 and q['imp'] >= MIN_IMP), key=lambda q: -q['imp'])
    for q in dead[:10]:
        print(f"  pos {q['pos']:5.1f}  imp {q['imp']:6.0f}  {q['key']}")
    if not dead:
        print('  none')

    # Per-template view: one bad template is a systemic problem, not 900 page problems.
    print('\n== by page template (path segments containing digits collapsed to :var) ==')
    groups = defaultdict(list)
    for p in pages:
        path_ = re.sub(r'^https?://[^/]+', '', p['key']) or '/'
        groups[re.sub(r'/[^/]*\d[^/]*', '/:var', path_)].append(p)
    for tpl, rows in sorted(groups.items(), key=lambda kv: -sum(r['imp'] for r in kv[1]))[:12]:
        print(f"  {len(rows):4d} pages  " + summarize(tpl[:40], rows)[23:] + f"   {tpl}")


if __name__ == '__main__':
    main()
```

### B.11 Bot triage and crawler verification

Requests, bytes and errors per crawler from a combined-format access log.
*Tested:* Sample log with Googlebot, PetalBot, SemrushBot and a browser; the verifier below confirmed a real Googlebot IP by DNS and rejected a residential IP sending a Googlebot user-agent.

`bot-triage.sh`

```bash
#!/usr/bin/env bash
# bot-triage.sh — who is crawling, what it costs, and whether it's worth it.
# Usage: ./bot-triage.sh access.log      (combined log format: nginx/Apache default)
# Most CDN/host dashboards show the same breakdown (Vercel: Observability →
# Edge Requests → Bot Name; Cloudflare: Security → Bots). Use this when you have raw logs.
set -eu
LOG="${1:?usage: bot-triage.sh access.log}"
printf '%-28s %9s %11s %7s\n' agent requests MB 4xx/5xx
awk -F'"' '
  { split($3, a, " "); status = a[1]; bytes = (a[2] ~ /^[0-9]+$/) ? a[2] : 0; ua = $6
    bot = "human/other"
    if (match(ua, /[A-Za-z-]*([Bb]ot|[Cc]rawler|[Ss]pider|Slurp|facebookexternalhit|meta-externalagent)[A-Za-z-]*/)) bot = substr(ua, RSTART, RLENGTH)
    n[bot]++; b[bot] += bytes; if (status >= 400) e[bot]++ }
  END { for (k in n) printf "%-28s %9d %11.1f %7d\n", k, n[k], b[k] / 1048576, e[k] }' "$LOG" | sort -k2 -nr
```

`verify-googlebot.sh`

```bash
#!/usr/bin/env bash
# verify-googlebot.sh — is an IP claiming to be Googlebot really Google?
# Usage: ./verify-googlebot.sh 66.249.66.1 [ip ...]
# Google's documented method: reverse DNS must end in googlebot.com, google.com
# or googleusercontent.com, AND a forward lookup of that name must return the
# same IP. A user-agent string alone proves nothing — it is trivially spoofed.
# (Bing documents the same method with search.msn.com.)
for ip in "$@"; do
  name=$(getent hosts "$ip" | awk '{print $2}')
  if [[ ! "$name" =~ \.(googlebot|google|googleusercontent)\.com$ ]]; then echo "FAKE  $ip  (reverse DNS: ${name:-none})"; continue; fi
  if getent ahosts "$name" | awk '{print $1}' | grep -qx "$ip"; then echo "REAL  $ip  $name"; else echo "FAKE  $ip  ($name does not resolve back)"; fi
done
```

### B.12 IndexNow submitter

Minimal submission of changed URLs (5.3).
*Tested:* Against a mock endpoint: payload shape correct, 202 treated as success, a URL on a foreign host rejected with 422 and a non-zero exit.

`indexnow.mjs`

```js
// indexnow.mjs — tell Bing, Yandex, Naver, Seznam and Yep that URLs changed.
// Google does not take part; for Google, keep the sitemap's lastmod accurate.
// Usage: INDEXNOW_KEY=<key> SITE=https://www.example.com node indexnow.mjs /changed-a /changed-b
// Setup, once: serve the key as plain text at SITE/<key>.txt (8-128 chars, a-z A-Z 0-9 -).
// Rules that keep the signal worth something:
//   - submit only URLs whose content changed, never the whole sitemap on a schedule
//   - submit after the deploy is live, or engines re-crawl the old page
//   - 200 and 202 are success (202 = key still being validated, normal on first use)
const SITE = process.env.SITE;
const KEY = process.env.INDEXNOW_KEY;
const ENDPOINT = process.env.INDEXNOW_ENDPOINT ?? 'https://api.indexnow.org/indexnow';
const urls = process.argv.slice(2).map((p) => new URL(p, SITE).href);
if (!SITE || !KEY || !urls.length) { console.error('set SITE and INDEXNOW_KEY, pass paths'); process.exit(2); }
if (urls.length > 10000) { console.error('IndexNow accepts at most 10,000 URLs per request'); process.exit(2); }

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
});
// 400 bad request, 403 key not found/invalid, 422 URLs not on this host, 429 too many requests
console.log(`${res.status} ${res.statusText} — ${urls.length} URL(s)`);
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
```

---

## Appendix C — Templates

### C.1 Intake questionnaire

```markdown
## Business
- What does the site sell or offer? What is a valuable visit (purchase, lead, sign-up, ad view)?
- Who is the audience? Which countries and languages?
- Top 3 competitors in search (not just in business)?
- Any regulated topic (finance, health, legal, safety)?

## Current state
- Monthly organic clicks (Search Console) and trend over 16 months?
- Which page types get the organic traffic today?
- Other channels: direct, referral, social, AI assistants?
- Referring domains (approx.) and branded search volume?

## Technical
- Framework and rendering mode (SSG / ISR / SSR / SPA)? CMS?
- Hosting and plan limits (bandwidth, cache reads/writes, function time)?
- How often does the site deploy, and does content change trigger a deploy?
- Number of URLs, by type? Any generated at scale?
- Languages/regions: URL structure? hreflang?

## Access
- Search Console (owner or full user)? Bing Webmaster Tools? Analytics? Logs? Host dashboard? Repository?

## Constraints and history
- Past migrations, URL changes, penalties, traffic drops (with dates)?
- Release process, reviews, legal constraints?
- What must not change?
```

### C.2 Keyword-to-URL map

One row per target query cluster. Columns:

```text
cluster | example queries | intent (know/do/buy/go/visit) | SERP format | est. demand |
target URL | status (exists/new/merge) | current position | winnable? (why) | priority
```

Every cluster has exactly one target URL. Two clusters with the same URL are
fine; one cluster with two URLs is cannibalization.

### C.3 Page template spec

Fill this in before building any template that will be rendered many times.

```text
Template:            e.g. product, location, dated archive day
URL pattern:         /products/{slug}   (stable; no volatile data)
Primary intent:      the query shape this page answers
Title pattern:       {Product} — {key attribute} | Brand     (keyword part ≤ 60 chars)
Description pattern: lead with the page-specific fact            (≤ 155 chars)
H1:                  …
Required content:    blocks that make each page different in substance (8.3)
Indexation rule:     index if …; noindex if …; don't publish if …   (one tested function)
Canonical:           self, absolute
Structured data:     types and required properties
Links in:            which hubs and sibling pages link here (≥ 3 in-content)
Links out:           siblings, parent hub, related (4–8)
Empty/expired state: behaviour and status code (3.5)
Sitemap:             included when … ; lastmod source
Weight budget:       ≤ … KB HTML; data serialized only for what is drawn
Social image:        present and verified on a real URL
```

### C.4 Redirect map

```text
# old,new — one hop, permanent, closest equivalent; comments allowed
/old-category/widget-a,/products/widget-a
/blog/2019/05/post-title,/guides/post-title
/discontinued-item,/products/replacement-item
```

Verify with B.9 on staging before launch and daily for the first week after.

### C.5 Change log entry

```text
date (UTC) | deploy/commit | what changed | pages/templates affected |
expected effect | how to measure (script, report, window) | result (filled later)
```

Also log external events: core and spam updates, platform data events
(backfills, report changes), outages.

### C.6 Monthly report outline

1. **Conclusion first**: one paragraph — better, worse, why, what next.
2. **Numbers** (equal windows, with sources): clicks, impressions, CTR,
   position by template; indexed pages by sitemap; AI citations; conversions.
3. **What changed** this month (from the change log) and its measured effect.
4. **What is broken** (audit outputs), ranked by impact.
5. **Next month's plan**, and what data would change it.

---

## Appendix D — Checklists

### D.1 Pre-launch

- [ ] Staging `noindex` and robots.txt blocks removed; verified on the live domain
- [ ] One canonical host; http→https and www/bare redirects in one hop
- [ ] Unknown URLs return a real 404; a valid sibling returns 200 (B.1)
- [ ] robots.txt allows what should be crawled, blocks internal search and facet noise (B.2)
- [ ] Every template: one H1, title, description, self-canonical, social image, structured data (B.3)
- [ ] `<html lang>` correct on every language version
- [ ] Sitemaps list only 200, indexable, self-canonical URLs with honest `lastmod` (B.4)
- [ ] Every indexable page reachable by links; no orphans (B.5)
- [ ] Page weight within budget per template (B.6)
- [ ] hreflang valid, if multilingual (B.7)
- [ ] Redirect map verified, if replacing a site (B.9)
- [ ] Core Web Vitals acceptable in lab tests on the heaviest templates
- [ ] Search Console and Bing Webmaster Tools verified; sitemaps submitted; analytics recording
- [ ] Bot policy decided (robots.txt, firewall) (Part 15)

### D.2 New page template

- [ ] Template spec filled in (C.3)
- [ ] Target intent not already owned by another URL (C.2)
- [ ] One H1; title keyword part ≤ 60 characters; description ≤ 155
- [ ] Self-referencing absolute canonical
- [ ] Social image verified present in the rendered HTML
- [ ] Structured data valid, describing visible content, no duplicate keys
- [ ] Linked from ≥ 3 other pages' body content; added to the link library
- [ ] In the sitemap — verified, not assumed
- [ ] Invalid parameters 404; valid ones 200
- [ ] At scale: similarity measured (B.8); index policy function tested
- [ ] Weight budget met (B.6); no data serialized beyond what is drawn
- [ ] Content present in the server HTML

### D.3 Every deploy (smoke test)

- [ ] Status probe of one URL per template, including 404 and redirect cases (B.1)
- [ ] robots.txt unchanged unless intended (B.2)
- [ ] Page audit on changed templates (B.3)
- [ ] Sitemap still valid; nothing newly 404 (B.4)
- [ ] IndexNow submitted for changed URLs after the deploy is live (B.12)

### D.4 Before claiming a fix works

- [ ] Measured on a production build, and confirmed it is the **new** build (server log)
- [ ] Content and links measured on the rendered DOM
- [ ] Attributes matched case-insensitively
- [ ] A valid sibling still works (no regression disguised as a fix)
- [ ] The check was shown to fail on the defect (negative control)
- [ ] Cross-checked with an independent method or source where possible
- [ ] Results differ from the baseline in an explainable way
- [ ] No sitemap URL started failing as a side effect

### D.5 Monthly health check

- [ ] Search Console: equal-window comparison by template (B.10)
- [ ] Pages report: counts per reason; open the examples for any that grew
- [ ] Enhancements and manual actions/security issues
- [ ] Bing Webmaster Tools: errors, AI Performance citations
- [ ] Hosting usage: trend, bot share, top routes by bytes (Part 15)
- [ ] Change log up to date; external events noted

### D.6 Quarterly audit

- [ ] Full Appendix B run on every template; diff against last quarter
- [ ] Fresh invalid-slug probes (bots invent new ones)
- [ ] Link graph: orphans, depth, spread (B.5)
- [ ] Full sitemap audit, not sampled (`SAMPLE=0`)
- [ ] Similarity of the largest template (B.8)
- [ ] Backlink profile: new referring domains, spam patterns
- [ ] Content decay and cannibalization review (7.4, 7.6)
- [ ] Coverage and accuracy claims in text re-checked against the data
- [ ] Code comments describing SEO behaviour still match the code
- [ ] Third-party scripts reviewed (11.5)
- [ ] Dated facts in this playbook re-checked against primary sources

### D.7 Migration

- [ ] Full URL inventory (sitemaps, crawl, Search Console 16 months, analytics, backlinks)
- [ ] Redirect map, one-to-one, no homepage dumping (C.4)
- [ ] Redirects permanent, single hop, at the edge, before route validation
- [ ] Map verified on staging (B.9)
- [ ] Internal links, canonicals, hreflang, structured data, sitemaps updated
- [ ] Change of Address filed (domain moves)
- [ ] Baseline captured by template (1.4)
- [ ] Rollback criteria written down
- [ ] Daily redirect and 404 checks for a week; weekly for 12 weeks
- [ ] Redirects kept at least a year

---

## One-page summary

1. **SEO defects are silent.** Measure the rendered output of production builds;
   never infer from code.
2. **Prove every check can fail**, and test against external truth.
3. **Ask for the data you cannot see**; never present a guess as a finding.
4. **Find the binding constraint** — crawl, index, rank, click or value — before
   building anything.
5. **Match the intent and the format** of what ranks; one primary intent per URL.
6. **Real status codes.** Unknown URLs 404; moved URLs 301/308 in one hop;
   legacy redirects run before route validation.
7. **robots.txt controls crawling, not indexing**; longest rule wins; never block
   what you need de-indexed.
8. **Every signal must agree**: canonical, sitemap, internal links, served URL.
9. **Sitemaps list only 200, indexable, self-canonical URLs** with honest
   `lastmod`.
10. **Short is fine; undifferentiated is not.** Measure similarity; publish only
    pages with data and demand, by an explicit tested rule.
11. **Structured data describes visible content** and earns eligibility, not
    rankings — and many rich result types are gone.
12. **A page nothing links to does not exist.** Count in-content inbound links;
    cross-link siblings.
13. **Page weight is a bill.** Serialize only what is drawn; load the rest on
    demand.
14. **Earn editorial links with assets** — data, tools, APIs — and distribute
    them.
15. **Be citable**: direct answers, checkable facts, tables, methodology,
    content in the server HTML. Never try to manipulate AI answers.
16. **Most traffic on small sites is bots.** Triage by value and cost; verify
    search crawlers by DNS; never block Googlebot to save money.
17. **Read Search Console carefully**: anonymized queries, 1,000-row cap, equal
    windows, examples before conclusions.
18. **Migrations**: full inventory, one-to-one permanent redirects verified
    before launch, twelve weeks of monitoring.
19. **Never fabricate** data, reviews, dates, authors or markup; distinguish zero
    from unknown.
20. **Report honestly** — verified vs inferred, bad news included.
