/* oxlint-disable next/no-html-link-for-pages -- Use document navigation: vinext's production Link handler fails on these public routes. */
import type { Metadata } from 'next';
import PolicyPage from '../policy-page';

export const metadata: Metadata = {
  title: 'Cookies policy | Scribo',
  description:
    'Browser draft storage, provider-managed cookies, storage duration, and your controls on Scribo.',
};

export default function CookiesPage() {
  return (
    <PolicyPage slug="cookies">
      <section>
        <h2>1. Cookies and browser storage are different</h2>
        <p>
          Cookies are small values a browser can send to a website with
          requests. Local storage keeps data in a browser for a website across
          visits. Session storage is associated with a browser tab’s page
          session. Local storage and session storage are not cookies and are not
          automatically attached to web requests.
        </p>
        <p>
          Scribo’s application code does not set its own cookies. It uses the
          browser storage below to save writing progress and continue a guest
          draft after sign-in. For signed-in students, the application also
          sends drafts to its server through its save feature.
        </p>
      </section>
      <section>
        <h2>2. Storage used by Scribo</h2>
        <p>
          In these names, <code>{'{assignmentToken}'}</code> identifies the
          assignment link and <code>{'{encodedUserId}'}</code> is the signed-in
          user identifier encoded for use in the storage key.
        </p>
        <div className="policy-storage-list">
          <section>
            <h3>Guest draft</h3>
            <p>
              <code>{'scribo-student-draft:{assignmentToken}'}</code>
            </p>
            <dl>
              <dt>Type</dt>
              <dd>localStorage</dd>
              <dt>Purpose and contents</dt>
              <dd>
                Restores a guest’s name, essay text and formatting, writing
                events, pasted-text records, pause records, and draft timing in
                the same browser.
              </dd>
              <dt>Duration</dt>
              <dd>
                No timed expiry is configured. The application removes the
                current guest draft after successful submission, or after
                successfully transferring it to an account. It may otherwise
                remain until site data is cleared or the browser removes it.
              </dd>
            </dl>
          </section>
          <section>
            <h3>Account draft backup</h3>
            <p>
              <code>
                {'scribo-account-draft:{encodedUserId}:{assignmentToken}'}
              </code>
            </p>
            <dl>
              <dt>Type</dt>
              <dd>localStorage</dd>
              <dt>Purpose and contents</dt>
              <dd>
                Keeps an account draft backup in this browser, including the
                writing data above and revision and save-status information used
                to recover unsaved edits and detect conflicts.
              </dd>
              <dt>Duration</dt>
              <dd>
                No timed expiry is configured. The current browser backup is
                removed after successful submission. Signing out does not clear
                it. Copies in other browsers or tabs are not centrally erased.
              </dd>
            </dl>
          </section>
          <section>
            <h3>Guest-to-account transfer marker</h3>
            <p>
              <code>{'scribo-transfer:{assignmentToken}'}</code>
            </p>
            <dl>
              <dt>Type</dt>
              <dd>sessionStorage</dd>
              <dt>Purpose and contents</dt>
              <dd>
                A “yes” marker tells the writing page to offer the guest draft
                after returning from sign-in. The marker itself contains no
                essay text.
              </dd>
              <dt>Duration</dt>
              <dd>
                No timed expiry is configured. The application removes it after
                a successful transfer save or when the user chooses the existing
                account draft. Otherwise it lasts for the tab’s page session;
                browser session restoration can affect when session storage is
                cleared.
              </dd>
            </dl>
          </section>
        </div>
      </section>
      <section>
        <h2>3. Hosting and sign-in providers</h2>
        <p>
          Scribo runs on OpenAI Sites with Cloudflare infrastructure and offers
          ChatGPT sign-in. Hosting and sign-in services can manage cookies and
          other storage outside Scribo’s source code, for example for
          authentication, security, or delivery of their services. Scribo does
          not configure their cookie names or lifetimes, and this application
          inventory does not establish an exhaustive list of provider cookies.
        </p>
        <p>
          See{' '}
          <a href="https://openai.com/policies/cookie-policy/">
            OpenAI’s Cookie policy
          </a>
          ,{' '}
          <a href="https://openai.com/policies/privacy-policy/">
            OpenAI’s Privacy policy
          </a>
          , and{' '}
          <a href="https://www.cloudflare.com/privacypolicy/">
            Cloudflare’s Privacy policy
          </a>{' '}
          for their descriptions. Provider-wide notices do not mean every
          technology described there runs on every Scribo page. Your browser’s
          site-data controls show storage present in your own session.
        </p>
      </section>
      <section>
        <h2>4. Analytics and external websites</h2>
        <p>
          Scribo does not include application-level advertising cookies,
          marketing pixels, visitor-analytics scripts, third-party
          error-reporting SDKs, or general browsing-session replay. Its
          educational writing replay is generated from editor events and is part
          of the essay service, as explained in the{' '}
          <a href="/policies/privacy">Privacy policy</a>.
        </p>
        <p>
          The YouTube tutorial, donation website, and research reference are
          outbound links, not embeds. Opening them takes you to another service
          where its own storage rules apply. Scribo uses system fonts and
          bundled interface icons rather than externally loaded font or icon
          services.
        </p>
      </section>
      <section>
        <h2>5. Your controls</h2>
        <p>
          You can inspect, block, or clear cookies and site storage in your
          browser settings. Clearing only cookies may leave local drafts intact;
          to remove those, clear this website’s local storage or site data too.
          Clearing browser storage does not delete account drafts or submitted
          work held on Scribo’s server.
        </p>
        <p>
          Download important work before clearing storage. Blocking browser
          storage can prevent guest recovery and account backup; blocking
          provider cookies can interfere with sign-in. Private browsing or a
          different browser or device may not retain or expose the same draft.
        </p>
        <p>
          Signing out ends your use of the signed-in session but does not erase
          saved browser backups or server records. Scribo has no in-app cookie
          preference panel. For questions or requests concerning server-held
          information, contact the operator using the email above.
        </p>
      </section>
    </PolicyPage>
  );
}
