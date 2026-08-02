import { archiveMetadata, renderArchiveIndex } from '@/lib/archive-index';

export const revalidate = 86400;
export const metadata = archiveMetadata('XAG');

export default function SilverPriceArchivePage() {
    return renderArchiveIndex('XAG');
}
