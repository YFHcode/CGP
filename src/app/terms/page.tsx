import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'Terms of Service',
    description: `The terms governing use of ${SITE_NAME}, including our financial disclaimer and limits on liability.`,
    path: '/terms',
});

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            updated="2 August 2026"
            breadcrumb={{ name: 'Terms of service', path: '/terms' }}
        >
            <p>
                By using www.chartgoldprice.com you agree to these terms. If you do not agree, please do
                not use the site.
            </p>

            <h2>Not financial advice</h2>
            <p>
                <strong>
                    Nothing on {SITE_NAME} is financial, investment, legal or tax advice.
                </strong>{' '}
                All content is general information published for reference only. It does not account
                for your circumstances, objectives or risk tolerance. Always consult a qualified,
                regulated adviser before making an investment decision.
            </p>

            <h2>Accuracy of prices</h2>
            <p>
                Prices are obtained from third-party providers and are refreshed on a schedule. They
                are indicative reference prices, <strong>not live trading quotes</strong>, and may be
                delayed, incomplete or wrong. The time of the most recent update is displayed beside
                the prices.
            </p>
            <p>
                Do not rely on this site for trade execution, settlement, valuation for insurance or
                tax, or any other purpose requiring an authoritative price. Confirm with your dealer,
                broker or a professional valuer before transacting.
            </p>

            <h2>The calculator</h2>
            <p>
                The gold calculator returns an estimated <em>melt value</em>: weight multiplied by
                purity multiplied by spot price. It excludes dealer margins, refining charges,
                assay costs, VAT or sales tax, and any numismatic or design premium. Actual offers
                you receive will differ, usually by a significant margin.
            </p>

            <h2>Availability</h2>
            <p>
                The site is provided &quot;as is&quot; and &quot;as available&quot;, without
                warranties of any kind. We do not guarantee uninterrupted access or that content is
                free of errors.
            </p>

            <h2>Limitation of liability</h2>
            <p>
                To the fullest extent permitted by law, {SITE_NAME} is not liable for any loss or
                damage — including trading losses, lost profits or indirect and consequential loss —
                arising from your use of, or reliance on, this site or its data.
            </p>

            <h2>External links</h2>
            <p>
                We link to third-party news articles and websites. We do not control and are not
                responsible for their content, accuracy or privacy practices.
            </p>

            <h2>Intellectual property</h2>
            <p>
                Site content and design are the property of {SITE_NAME}, except third-party data and
                news headlines, which remain the property of their respective owners.
            </p>

            <h2>Changes</h2>
            <p>
                We may revise these terms at any time. Continued use after changes are posted
                constitutes acceptance.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about these terms? Use our <Link href="/contact">contact page</Link>.
            </p>
        </LegalPage>
    );
}
