import { MINOR_METALS } from '@/lib/minor-metals';
import { MinorMetalPage, minorMetalMetadata } from '@/lib/minor-metal-route';

// Declared literally, not re-exported: Next only recognises route segment
// config as a direct export of the route file.
export const revalidate = 10800;

export const generateMetadata = () => minorMetalMetadata(MINOR_METALS.XPD);

export default function PalladiumPricePage() {
    return <MinorMetalPage metal={MINOR_METALS.XPD} />;
}
