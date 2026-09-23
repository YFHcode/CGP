import type { NextConfig } from "next";

/** Applied to every route. Cheap wins that were previously absent. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Legacy archive URLs → canonical readable slugs, as permanent redirects.
 *
 * The archive used ISO slugs (/gold-price/2010-05-06, /gold-price/2010-05)
 * before moving to readable ones (/gold-price/6-may-2010, /gold-price/may-2010),
 * and the page redirected the old form itself. That stopped working when the
 * [period] routes gained `dynamicParams = false` to end soft 404s: an ISO slug
 * is not a prerendered param, so the router 404s it before the page — and its
 * redirect — ever runs. Every external link to the old format broke silently.
 *
 * Rules here run in the router, ahead of that check, and cost no function
 * invocation. They are generated per month because a redirect destination can
 * reorder captured values but not transform them: "05" has to become "may" and
 * "06" has to become "6" by matching, not by computation.
 *
 * Permanent (308), one hop, straight to the canonical slug. Dates outside the
 * archive still redirect, then 404 on the canonical URL — the same outcome the
 * in-page redirect produced.
 */
export function legacyPeriodRedirects() {
  const rules = [];
  for (const base of ["/gold-price", "/silver-price"]) {
    MONTHS.forEach((name, index) => {
      const mm = String(index + 1).padStart(2, "0");
      rules.push(
        // 2010-05-06 → 6-may-2010: a zero-padded day loses its zero…
        { source: `${base}/:year(\\d{4})-${mm}-0:day([1-9])`, destination: `${base}/:day-${name}-:year`, permanent: true },
        // …10 to 31 pass through unchanged.
        { source: `${base}/:year(\\d{4})-${mm}-:day(1\\d|2\\d|3[01])`, destination: `${base}/:day-${name}-:year`, permanent: true },
        // 2010-05 → may-2010
        { source: `${base}/:year(\\d{4})-${mm}`, destination: `${base}/${name}-:year`, permanent: true },
      );
    });
    // The readable form also used to accept a zero-padded day (06-may-2010).
    rules.push({ source: `${base}/0:day([1-9])-:rest([a-z]+-\\d{4})`, destination: `${base}/:day-:rest`, permanent: true });
  }
  return rules;
}

const nextConfig: NextConfig = {
  experimental: {
    // The site has two root layouts — (site) in English and [locale] for the
    // translated pages, so each can declare its real <html lang>. With more
    // than one root layout, unmatched URLs need app/global-not-found.tsx to
    // render the styled 404 instead of Next's unstyled default.
    globalNotFound: true,
  },
  async redirects() {
    return legacyPeriodRedirects();
  },
  images: {
    // News thumbnails and Sanity assets are remote, so next/image needs them
    // allowlisted before it will optimise (or even render) them.
    remotePatterns: [
      { protocol: "https", hostname: "**.gstatic.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "serpapi.com" },
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
