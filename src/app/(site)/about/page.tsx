import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'About Us',
    description: `What ${SITE_NAME} does, where our gold and silver price data comes from, and how often it is updated.`,
    path: '/about',
});

export default function AboutPage() {
    return (
        <LegalPage title={`About ${SITE_NAME}`} breadcrumb={{ name: 'About us', path: '/about' }}>
            <p>
                {SITE_NAME} publishes gold and silver spot prices with historical charts, a
                karat-aware value calculator and market news — free, with no account required.
            </p>

            <h2>What you can do here</h2>
            <ul>
                <li>
                    Check <Link href="/gold-price-today">today&apos;s gold price</Link> and{' '}
                    <Link href="/silver-price-today">silver price</Link> per ounce, gram or kilogram
                </li>
                <li>
                    View <Link href="/gold-price-history">historical charts</Link> across one week to
                    one year
                </li>
                <li>
                    Estimate what your jewellery or bullion is worth with the{' '}
                    <Link href="/gold-price-calculator">gold calculator</Link>
                </li>
                <li>Switch between eight currencies: USD, EUR, GBP, CAD, AUD, JPY, CNY and INR</li>
                <li>
                    Follow <Link href="/news">market news</Link> affecting precious metals
                </li>
            </ul>

            <h2>Where the data comes from</h2>
            <p>
                Spot prices come from a commercial precious-metals data provider. Historical daily
                closes come from public market data. Exchange rates come from a foreign-exchange API,
                and news headlines from a search data provider.
            </p>

            <h2>How often it updates</h2>
            <p>
                Prices are refreshed on a fixed schedule rather than streamed continuously, and the
                exact time of the last update is shown beneath the price cards on every page. These
                are <strong>indicative reference prices, not live trading quotes</strong> — see our{' '}
                <Link href="/terms">terms</Link> for what that means in practice.
            </p>

            <h2>Independence</h2>
            <p>
                We do not buy or sell precious metals, and we do not accept payment to feature
                particular dealers. Nothing here is financial advice.
            </p>

            <h2>Get in touch</h2>
            <p>
                Spotted an error or have a suggestion? Please{' '}
                <Link href="/contact">contact us</Link> — corrections are welcome.
            </p>
        </LegalPage>
    );
}
