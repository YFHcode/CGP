import { MINOR_METALS } from '@/lib/minor-metals';
import { MinorMetalPage, minorMetalMetadata } from '@/lib/minor-metal-route';

// Declared literally, not re-exported: Next only recognises route segment
// config as a direct export of the route file.
// Static until the next deploy: see the note on readJson in src/lib/prices.ts.
// Every figure on this page is read from committed JSON, so revalidating
// regenerates byte-identical output and costs an ISR write for nothing.
export const revalidate = false;

export const generateMetadata = () => minorMetalMetadata(MINOR_METALS.XPD);

export default function PalladiumPricePage() {
    return <MinorMetalPage metal={MINOR_METALS.XPD} />;
}
