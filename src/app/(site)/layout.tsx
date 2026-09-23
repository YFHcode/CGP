import { SiteDocument } from '@/components/SiteDocument';
import { rootMetadata, rootViewport } from '@/lib/root-metadata';

export const metadata = rootMetadata;
export const viewport = rootViewport;

/**
 * Root layout for the English site — every route except the translated pages,
 * which have their own root layout in src/app/[locale]/layout.tsx so that each
 * can declare its real <html lang>. The (site) folder is a route group: it
 * organises files without appearing in any URL.
 */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <SiteDocument lang="en">{children}</SiteDocument>;
}
