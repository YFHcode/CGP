import { archiveMetadata, renderArchiveIndex } from '@/lib/archive-index';

export const revalidate = 86400;
export const metadata = archiveMetadata('XAU');

export default function GoldPriceArchivePage() {
    return renderArchiveIndex('XAU');
}
