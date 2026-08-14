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
        host: SITE_URL,
    };
}
