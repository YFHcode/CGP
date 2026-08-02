import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata = pageMetadata({
    title: 'Privacy Policy',
    description: `How ${SITE_NAME} collects, uses and protects your data, including analytics cookies and third-party services.`,
    path: '/privacy-policy',
});

export default function PrivacyPolicyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            updated="2 August 2026"
            breadcrumb={{ name: 'Privacy policy', path: '/privacy-policy' }}
        >
            <p>
                This policy explains what information {SITE_NAME} collects when you visit
                chartgoldprice.com, why it is collected, and what choices you have.
            </p>

            <h2>Information we collect</h2>
            <p>
                We do not ask for or store names, email addresses or payment details. There are no
                user accounts on this site.
            </p>
            <p>We do collect limited technical and usage information automatically:</p>
            <ul>
                <li>Pages viewed, time on page and referring site</li>
                <li>Approximate location, derived from your IP address at country or city level</li>
                <li>Device type, browser and screen size</li>
            </ul>

            <h2>Cookies and analytics</h2>
            <p>We use the following third-party services, which set their own cookies:</p>
            <ul>
                <li>
                    <strong>Google Analytics</strong> (via Google Tag Manager) — aggregate traffic
                    statistics. See{' '}
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                        Google&apos;s privacy policy
                    </a>
                    .
                </li>
                <li>
                    <strong>Vercel Analytics</strong> — privacy-focused page performance metrics,
                    which do not use cookies for cross-site tracking.
                </li>
            </ul>
            <p>
                You can block cookies in your browser settings, or install{' '}
                <a
                    href="https://tools.google.com/dlpage/gaoptout"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Google&apos;s opt-out add-on
                </a>
                . The site works normally with cookies disabled.
            </p>

            <h2>Local storage</h2>
            <p>
                Your selected display currency is saved in your browser&apos;s local storage so it
                persists between visits. It never leaves your device and is not sent to us.
            </p>

            <h2>Third-party data providers</h2>
            <p>
                Price, exchange-rate and news data is supplied by third-party providers. Your browser
                may load news thumbnail images directly from those providers, which means they can
                see your IP address. We do not share any other information with them.
            </p>

            <h2>Your rights</h2>
            <p>
                Depending on where you live, you may have the right to access, correct or delete
                personal data held about you, or to object to its processing. Because we do not
                maintain accounts, most requests concern analytics data — contact us and we will
                help where we can.
            </p>

            <h2>Children</h2>
            <p>
                This site is not directed at children under 13 and we do not knowingly collect their
                information.
            </p>

            <h2>Changes</h2>
            <p>
                We may update this policy from time to time. Material changes will be reflected in
                the &quot;last updated&quot; date above.
            </p>

            <h2>Contact</h2>
            <p>
                Questions about this policy? Use our <Link href="/contact">contact page</Link>.
            </p>
        </LegalPage>
    );
}
