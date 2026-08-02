import {
    periodMetadata,
    periodStaticParams,
    renderPeriodPage,
} from '@/lib/period-route';

export const revalidate = 86400;

export function generateStaticParams() {
    return periodStaticParams('XAU');
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }) {
    const { period } = await params;
    return periodMetadata('XAU', period);
}

export default async function GoldPeriodPage({ params }: { params: Promise<{ period: string }> }) {
    const { period } = await params;
    return renderPeriodPage('XAU', period);
}
