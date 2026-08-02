import {
    periodMetadata,
    periodStaticParams,
    renderPeriodPage,
} from '@/lib/period-route';

export const revalidate = 86400;

export function generateStaticParams() {
    return periodStaticParams('XAG');
}

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }) {
    const { period } = await params;
    return periodMetadata('XAG', period);
}

export default async function SilverPeriodPage({ params }: { params: Promise<{ period: string }> }) {
    const { period } = await params;
    return renderPeriodPage('XAG', period);
}
