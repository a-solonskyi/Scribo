/* oxlint-disable next/no-html-link-for-pages -- Use document navigation: vinext's production Link handler fails on these public routes. */
import {
  POLICIES,
  POLICY_CONTACT,
  POLICY_UPDATED_DATE,
  POLICY_UPDATED_LABEL,
} from '@/src/policies';

export default function PolicyPage({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const policy = POLICIES.find((item) => item.slug === slug)!;
  return (
    <div className="policy-shell">
      <a className="policy-skip-link" href="#policy-content">
        Skip to policy
      </a>
      <header className="policy-site-header">
        <a className="wordmark" href="/" aria-label="Skribo home">
          [ˈskriː.boː]
        </a>
        <a className="policy-back-link" href="/">
          Back to Skribo
        </a>
      </header>
      <div className="policy-grid">
        <aside className="policy-navigation">
          <p>Terms &amp; Policies</p>
          <nav aria-label="Policy documents">
            {POLICIES.map((item) => (
              <a
                key={item.slug}
                href={`/policies/${item.slug}`}
                aria-current={item.slug === slug ? 'page' : undefined}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </aside>
        <main className="policy-document" id="policy-content" tabIndex={-1}>
          <header className="policy-document-header">
            <p className="policy-updated">
              Last updated{' '}
              <time dateTime={POLICY_UPDATED_DATE}>{POLICY_UPDATED_LABEL}</time>
            </p>
            <h1>{policy.title}</h1>
            <p className="policy-introduction">{policy.introduction}</p>
            <address className="policy-operator">
              Operated by Andrii Solonskyi · Ukraine
              <br />
              <a href={`mailto:${POLICY_CONTACT}`}>{POLICY_CONTACT}</a>
            </address>
          </header>
          {children}
          <footer className="policy-document-footer">
            <p>
              Questions about this policy? Contact{' '}
              <a href={`mailto:${POLICY_CONTACT}`}>{POLICY_CONTACT}</a>.
            </p>
            <a href="/">Back to Skribo</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
