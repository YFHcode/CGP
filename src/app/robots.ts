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
