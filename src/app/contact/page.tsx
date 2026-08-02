import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'Contact',
    description: `How to reach ${SITE_NAME} with corrections, questions or feedback about our gold and silver price data.`,
    path: '/contact',
});

// TODO: replace with your real address before launch.
const CONTACT_EMAIL = 'hello@chartgoldprice.com';

export default function ContactPage() {
    return (
        <LegalPage title="Contact Us" breadcrumb={{ name: 'Contact', path: '/contact' }}>
            <p>
                Questions, corrections or feedback about the data on {SITE_NAME}? We read everything
                that comes in.
            </p>

            <h2>Email</h2>
            <p>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-lg font-medium">
                    {CONTACT_EMAIL}
                </a>
            </p>
            <p>We aim to respond within a few business days.</p>

            <h2>What to include</h2>
            <p>If you are reporting a price or data error, it helps enormously if you include:</p>
            <ul>
                <li>The page URL where you saw it</li>
                <li>The value shown and the value you expected</li>
                <li>The time you saw it, and the currency you had selected</li>
            </ul>

            <h2>What we can&apos;t help with</h2>
            <p>
                We cannot give investment, tax or valuation advice, recommend dealers, or appraise
                specific items. See our <Link href="/terms">terms of service</Link> for details.
            </p>

            <h2>Privacy</h2>
            <p>
                Emails you send are used only to answer your enquiry. See our{' '}
                <Link href="/privacy-policy">privacy policy</Link>.
            </p>
        </LegalPage>
    );
}
