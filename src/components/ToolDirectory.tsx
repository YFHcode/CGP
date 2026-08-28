import Link from 'next/link';
import {
    Calculator,
    LineChart,
    CalendarDays,
    Coins,
    Code2,
    TrendingUp,
} from 'lucide-react';

/**
 * A full directory of what the site does, on the homepage.
 *
 * The homepage previously ended in six related links, chosen when the site had
 * roughly that many destinations. It now has four metals, a daily archive back
 * to 2000, forecasts, technical charts, five calculators and a public API —
 * and none of that was discoverable from the front page without opening a
 * dropdown.
 *
 * Grouped by the job a visitor came to do rather than by metal, because
 * "what's gold worth per gram" and "what's silver worth per gram" are the same
 * job and belong next to each other. Every entry says what the page gives you,
 * not just its name: a bare link list makes a reader guess.
 */

interface Tool {
    href: string;
    label: string;
    detail: string;
}

interface Category {
    title: string;
    icon: typeof Calculator;
    tools: Tool[];
}

const CATEGORIES: Category[] = [
    {
        title: 'Live prices',
        icon: TrendingUp,
        tools: [
            { href: '/gold-price-today', label: 'Gold price today', detail: 'Live spot, eight currencies' },
            { href: '/silver-price-today', label: 'Silver price today', detail: 'Live spot and day range' },
            { href: '/platinum-price', label: 'Platinum price', detail: 'Spot, fineness and demand drivers' },
            { href: '/palladium-price', label: 'Palladium price', detail: 'Spot and the autocatalyst story' },
            { href: '/gold-to-silver-ratio', label: 'Gold-to-silver ratio', detail: 'Relative value between the two' },
        ],
    },
    {
        title: 'Charts & analysis',
        icon: LineChart,
        tools: [
            { href: '/charts/gold', label: 'Gold chart', detail: 'RSI, MACD, Bollinger, 1W to full record' },
            { href: '/charts/silver', label: 'Silver chart', detail: 'The same technical panels for silver' },
            { href: '/gold-price-insights', label: 'Gold insights', detail: 'Moving averages, drawdowns, seasonality' },
            { href: '/silver-price-insights', label: 'Silver insights', detail: 'The same analytics for silver' },
            { href: '/gold-price-forecast', label: 'Gold forecast', detail: '7-day range, with its measured accuracy' },
            { href: '/silver-price-forecast', label: 'Silver forecast', detail: '7-day range for silver' },
        ],
    },
    {
        title: 'Calculators',
        icon: Calculator,
        tools: [
            { href: '/gold-price-calculator', label: 'Gold value calculator', detail: 'By weight and karat purity' },
            { href: '/silver-price-calculator', label: 'Silver value calculator', detail: 'By weight and fineness' },
            { href: '/gold-scrap-calculator', label: 'Scrap gold calculator', detail: 'And what buyers actually pay' },
            { href: '/melt-value', label: 'Coin melt value', detail: 'Junk silver and bullion coins' },
        ],
    },
    {
        title: 'Price history',
        icon: CalendarDays,
        tools: [
            { href: '/gold-price-history', label: 'Gold price history', detail: 'Charts and annual returns' },
            { href: '/silver-price-history', label: 'Silver price history', detail: 'Returns and deepest drawdowns' },
            { href: '/gold-price', label: 'Gold price archive', detail: 'Any day, month or year back to 2000' },
            { href: '/silver-price', label: 'Silver price archive', detail: 'The same archive for silver' },
        ],
    },
    {
        title: 'By unit & currency',
        icon: Coins,
        tools: [
            { href: '/gold-price-per/gram', label: 'Gold per gram', detail: 'Also ounce, kilo, tola, pavan' },
            { href: '/silver-price-per/gram', label: 'Silver per gram', detail: 'By unit and by fineness' },
            { href: '/gold-price-in/inr', label: 'Gold price in INR', detail: 'Plus EUR, GBP, CAD, AUD, JPY, CNY' },
            { href: '/uk', label: 'Gold price UK', detail: 'Sterling, hallmarks and VAT' },
        ],
    },
    {
        title: 'Data & developers',
        icon: Code2,
        tools: [
            { href: '/gold-price-api', label: 'Free JSON API', detail: 'No key, no rate limit, CORS enabled' },
            { href: '/openapi.json', label: 'OpenAPI spec', detail: 'Import into Postman or a client generator' },
            { href: '/news', label: 'Market news', detail: 'Headlines and a dated archive' },
            { href: '/blog', label: 'Analysis blog', detail: 'Longer-form pieces' },
        ],
    },
];

export function ToolDirectory() {
    return (
        <section className="bg-black py-14">
            <div className="container mx-auto px-4">
                <h2 className="mb-2 text-3xl font-bold text-white">Everything on this site</h2>
                <p className="mb-10 max-w-2xl text-zinc-300">
                    Grouped by what you came to do.
                </p>

                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {CATEGORIES.map(({ title, icon: Icon, tools }) => (
                        <div key={title}>
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gold-400">
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {title}
                            </h3>
                            <ul className="space-y-1">
                                {tools.map((tool) => (
                                    <li key={tool.href}>
                                        <Link
                                            href={tool.href}
                                            className="block rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
                                        >
                                            <span className="block text-sm font-medium text-zinc-100">
                                                {tool.label}
                                            </span>
                                            <span className="block text-xs text-zinc-400">
                                                {tool.detail}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
