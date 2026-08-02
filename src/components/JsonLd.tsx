import { jsonLdScript } from '@/lib/seo';

/**
 * Renders JSON-LD structured data.
 *
 * Server component — the previous version was a client component that pulled in
 * the currency context without using it, and emitted the same homepage FAQ and
 * a fixed breadcrumb trail on every page of the site.
 */
export function JsonLd({ schema }: { schema: object | object[] }) {
    const schemas = Array.isArray(schema) ? schema : [schema];

    return (
        <>
            {schemas.map((item, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={jsonLdScript(item)}
                />
            ))}
        </>
    );
}
