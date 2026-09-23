import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/navigation';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                // /api/data is deliberately crawlable: it is the documented,
                // citable JSON endpoint advertised in llms.txt. The rest of
                // /api/ stays blocked — those routes exist to serve the app,
                // not to be indexed. A more specific Allow wins over the
                // broader Disallow.
                allow: ['/', '/api/data'],
                disallow: ['/api/'],
            },
            {
                // Crawlers that cost ISR reads and send nothing back.
                //
                // Vercel's bot breakdown for twelve hours in September 2026:
                // PetalBot 529 requests and SemrushBot 523, each ~85% cache
                // misses — together about a quarter of all bot misses, and
                // every miss is a billed read of a ~113 KB archive page.
                // PetalBot feeds Huawei's Petal Search, which sends this site
                // no measurable traffic. The rest are SEO-tool crawlers that
                // index the site for other people's competitor research.
                //
                // Blocking SemrushBot does not touch Semrush's Authority
                // Score, which is computed from links on *other* sites. Its
                // Site Audit uses a separate agent, SiteAuditBot, which is
                // deliberately not listed, so auditing this site still works.
                //
                // Search engines (Googlebot, Bingbot, Applebot) and AI
                // assistants that cite sources (OAI-SearchBot and the like)
                // are not here: they are the reason the archive exists.
                userAgent: [
                    'PetalBot',
                    'SemrushBot',
                    'AhrefsBot',
                    'MJ12bot',
                    'DotBot',
                    'BLEXBot',
                    'DataForSeoBot',
                    'serpstatbot',
                    'Barkrowler',
                ],
                disallow: ['/'],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        // No `host:` directive.
        //
        // It is a Yandex extension that Google has never read and that Bing's
        // robots.txt tester reports as a hard error — one red cross against an
        // otherwise clean file, on a line that no crawler we care about acts
        // on. Yandex itself deprecated it in 2018 in favour of a 301 plus a
        // canonical, which is how the www/non-www choice is already settled
        // here. So it bought nothing and cost a parse error; it is gone.
    };
}
