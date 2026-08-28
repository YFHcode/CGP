import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards LINK_LIBRARY in src/components/RelatedLinks.tsx against the failure
 * that prompted it.
 *
 * A page absent from that library is a page no other page's body copy can link
 * to: relatedLinks() picks by key, so an unlisted page is reachable only from
 * the header, the footer and whatever hand-written prose happens to mention
 * it. The forecast, API, platinum and palladium pages all shipped that way and
 * sat at one in-content inbound link each while /silver-price-today had 46.
 *
 * Rather than mirroring the library's contents — which would only assert that
 * a copy of the data matches the data — this reads both sides from the
 * repository: the hrefs out of the source file, and the routes out of the app
 * directory. Adding a page without a library entry fails here.
 */

const ROOT = new URL('..', import.meta.url).pathname;
const SOURCE = join(ROOT, 'src/components/RelatedLinks.tsx');
const APP = join(ROOT, 'src/app');

const source = readFileSync(SOURCE, 'utf8');

/** The LINK_LIBRARY object literal, so hrefs elsewhere in the file don't count. */
function libraryBody() {
    const start = source.indexOf('export const LINK_LIBRARY');
    assert.ok(start > -1, 'LINK_LIBRARY not found — has it been renamed?');
    const end = source.indexOf('\n};', start);
    assert.ok(end > start, 'could not find the end of LINK_LIBRARY');
    return source.slice(start, end);
}

const body = libraryBody();
const hrefs = [...body.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);
const labels = [...body.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);

/** Every static (non-dynamic) route with a page.tsx. */
function staticRoutes(dir = APP, prefix = '') {
    const found = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        if (entry.startsWith('[') || entry.startsWith('(') || entry.startsWith('_')) continue;
        const route = `${prefix}/${entry}`;
        try {
            statSync(join(full, 'page.tsx'));
            found.push(route);
        } catch {
            // Directory without its own page — still walk into it.
        }
        found.push(...staticRoutes(full, route));
    }
    return found;
}

/**
 * Routes that deliberately carry no library entry.
 *
 * Legal and company pages are linked from the footer by design and are not
 * pages we want to push internal authority at. The locale pages are
 * translations addressed by hreflang, not by related-link cards.
 */
const EXEMPT = new Set(['/about', '/contact', '/privacy-policy', '/terms']);

test('every static route has a link-library entry', () => {
    const routes = staticRoutes().filter((r) => !EXEMPT.has(r));
    const linked = new Set(hrefs);
    const missing = routes.filter((r) => !linked.has(r));
    assert.deepEqual(
        missing,
        [],
        `these pages exist but nothing can link to them in content: ${missing.join(', ')}`
    );
});

test('the library covers the dynamic routes through a representative page', () => {
    // Dynamic routes can't be listed wholesale, so the library points at one
    // real instance of each. If these disappear, the whole template loses its
    // in-content inbound links.
    for (const href of [
        '/charts/gold',
        '/charts/silver',
        '/gold-price-per/gram',
        '/gold-price-in/inr',
        '/silver-price-per/gram',
        '/melt-value',
    ]) {
        assert.ok(hrefs.includes(href), `${href} should be in the library`);
    }
});

test('no href is listed twice', () => {
    const seen = new Set();
    const duplicates = hrefs.filter((h) => (seen.has(h) ? true : (seen.add(h), false)));
    assert.deepEqual(duplicates, [], `duplicate hrefs split anchor text: ${duplicates.join(', ')}`);
});

test('every entry has distinct anchor text', () => {
    // Two cards with the same label on one page is both a UX bug and a wasted
    // keyword signal.
    assert.equal(new Set(labels).size, labels.length, 'duplicate labels in LINK_LIBRARY');
});

test('anchor text is descriptive rather than generic', () => {
    const generic = /^(click here|read more|learn more|here|link)$/i;
    for (const label of labels) {
        assert.ok(!generic.test(label.trim()), `"${label}" carries no keyword signal`);
        assert.ok(label.trim().length >= 4, `"${label}" is too short to be descriptive`);
    }
});

test('every href is a site-relative path', () => {
    for (const href of hrefs) {
        assert.ok(href.startsWith('/'), `${href} is not site-relative`);
        assert.ok(!href.includes('://'), `${href} should not be absolute`);
    }
});
