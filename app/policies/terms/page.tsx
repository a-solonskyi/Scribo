/* oxlint-disable next/no-html-link-for-pages -- Use document navigation: vinext's production Link handler fails on these public routes. */
import type { Metadata } from 'next';
import PolicyPage from '../policy-page';

export const metadata: Metadata = {
  title: 'Terms and conditions | Skribo',
  description:
    'Terms for essay writing, process review, professor access, and donations on Skribo.',
};

export default function TermsPage() {
  return (
    <PolicyPage slug="terms">
      <section>
        <h2>1. About Skribo and these terms</h2>
        <p>
          Skribo is an educational tool for
          assigning essays, writing them in a browser, reviewing the writing
          process, and providing professor feedback. These terms govern your use
          of the service operated by Andrii Solonskyi in Ukraine. By using
          Skribo, you agree to these terms. If you do not agree, do not use the
          service.
        </p>
        <p>
          The <a href="/policies/privacy">Privacy policy</a> explains how
          information is handled, and the{' '}
          <a href="/policies/cookies">Cookies policy</a> explains browser
          storage.
        </p>
      </section>
      <section>
        <h2>2. Access and accounts</h2>
        <p>
          Professors sign in with ChatGPT and enter a valid invitation code to
          activate their workspace. Skribo receives an account identifier, email
          address, and name when supplied by the sign-in provider. It does not
          create or store your ChatGPT password. Keep your account access and
          invitation code secure, and use only access you are authorised to use.
        </p>
        <p>
          Students use an assignment link supplied by a professor. They may
          write as guests or sign in with ChatGPT to save progress to an
          account. Student sign-in does not grant professor access. A name
          entered on an essay is supplied by the student; guest submission does
          not verify that person’s identity.
        </p>
        <p>
          Anyone with an assignment link can view its topic, instructions, and
          deadline and use the writing form. Share those links with the intended
          participants, and do not put confidential information in public
          assignment instructions.
        </p>
      </section>
      <section>
        <h2>3. Your responsibilities</h2>
        <p>
          Provide accurate information, respect other people’s privacy and
          intellectual property, and follow the assignment rules that your
          professor or institution gives you. Do not impersonate another person,
          submit work without permission, attempt to access another user’s
          records, bypass access controls, introduce malicious code, or disrupt
          the service.
        </p>
        <p>
          Professors are responsible for deciding whether Skribo is appropriate
          for their course, explaining the collection of writing-process data to
          students, and meeting their institution’s requirements for handling
          student information. Share or export student work only when you are
          entitled to do so. Avoid including personal information that is
          unnecessary for the assignment.
        </p>
      </section>
      <section>
        <h2>4. Your content and permission to operate the service</h2>
        <p>
          You retain any rights you hold in your essays, instructions, comments,
          and other content. You give the operator permission to store,
          reproduce, process, and display that content as needed to provide the
          features you use, including draft saving, submission, writing replay,
          feedback, and exports. This permission does not transfer ownership of
          your work.
        </p>
        <p>
          When you submit an essay, its text and writing-process records become
          available to the professor who owns the assignment. That professor can
          download feedback as a PDF and create a Markdown file containing the
          essay and its available writing records.
        </p>
      </section>
      <section>
        <h2>5. Writing records and educational decisions</h2>
        <p>
          Skribo records changes made inside the essay editor, including
          inserted text, deletions, pasted text, timing, and pauses. Its replay
          and statistics support review of how an essay developed. They are not
          conclusive proof of authorship, misconduct, or use of AI. Professors
          should consider context, discuss concerns with students, and apply
          their institution’s assessment procedures.
        </p>
        <p>
          The AI prompt feature produces a file for the professor to download.
          Skribo does not run an AI analysis or automatically transmit essays to
          an AI service. A professor who uploads an export elsewhere is
          responsible for that disclosure and for reviewing the recipient’s
          terms.
        </p>
      </section>
      <section>
        <h2>6. Saving, submission, and deletion</h2>
        <p>
          Guest drafts are saved in the current browser. Account drafts are
          saved online, with a browser backup. Storage restrictions, connection
          failures, clearing site data, or conflicting edits can affect saving.
          Check the save status and download a copy of important work.
        </p>
        <p>
          The writing interface treats a successful submission as completed.
          Professors can delete their classes, assignments, submissions, and
          response annotations. Deleting a class or assignment also removes its
          related records, including account drafts. Deleting a submission
          removes its annotations but does not delete a separately saved account
          draft. Downloaded copies are outside these controls.
        </p>
        <p>
          You can stop using Skribo at any time. Signing out does not delete
          your records or browser backups. There is no self-service
          account-deletion control or scheduled automatic deletion. To request
          account or data deletion, contact the operator at the email above;
          students may also contact their professor about submitted work.
          Deleting a ChatGPT account does not itself invoke a Skribo deletion
          process.
        </p>
      </section>
      <section>
        <h2>7. Payments and voluntary support</h2>
        <p>
          Skribo currently has no paid plan, subscription, checkout, or
          recurring billing. The Donate menu displays bank-transfer details for
          supporting the developer and a link to the separate Come Back Alive
          donation website. Donations are optional and do not purchase access or
          a service entitlement.
        </p>
        <p>
          Transfers are handled outside Skribo by your bank or the external
          donation service. Skribo does not collect payment-card details or
          process cancellations or refunds. Contact your bank, the relevant
          recipient, or the external service about a transfer.
        </p>
      </section>
      <section>
        <h2>8. External providers and links</h2>
        <p>
          Skribo uses OpenAI Sites hosting, ChatGPT sign-in, and Cloudflare
          infrastructure and database services. Their services have their own
          terms and privacy information. The tutorial opens on YouTube after an
          invitation-code check. Donation and research links also take you to
          external websites; these are links, not embedded services. Third-party
          availability and practices are outside Skribo’s application controls.
        </p>
      </section>
      <section>
        <h2>9. Availability and changes</h2>
        <p>
          The service may change or be unavailable during maintenance, faults,
          or provider interruptions. Continuous access, error-free analytics,
          and recovery of lost work are not guaranteed. Keep copies of work you
          need. Nothing in these terms excludes rights or responsibilities that
          cannot lawfully be excluded.
        </p>
        <p>
          Changes to these terms will be published on this page with an updated
          date. Review them when deciding whether to continue using Skribo.
          Contact the operator about access problems, these terms, or concerns
          about use of the service.
        </p>
      </section>
    </PolicyPage>
  );
}
