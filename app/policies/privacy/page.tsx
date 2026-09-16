import Link from 'next/link';
import type { Metadata } from 'next';
import PolicyPage from '../policy-page';

export const metadata: Metadata = {
  title: 'Privacy policy | Scribo',
  description:
    'Information collected by Scribo, writing-process records, access, storage, deletion, and privacy requests.',
};

export default function PrivacyPage() {
  return (
    <PolicyPage slug="privacy">
      <section>
        <h2>1. Scope and responsibility</h2>
        <p>
          This policy describes the information handled through Scribo, the
          essay-writing and professor-feedback service operated by Andrii
          Solonskyi in Ukraine. It covers professors, students who sign in, and
          students who write as guests. It also explains where provider services
          and a professor’s own use of exported information are separate from
          the application.
        </p>
        <p>
          If a professor or institution asks you to use Scribo, ask them about
          their course requirements, assessment practices, and any separate
          handling of your information.
        </p>
      </section>
      <section>
        <h2>2. Information collected and its sources</h2>
        <ul>
          <li>
            <strong>Sign-in information.</strong> ChatGPT sign-in supplies a
            user identifier and email address, and a name when available.
            Approved professor records store the identifier, email, display
            name, and activation date. Signed-in student drafts are associated
            with the user identifier. Scribo does not receive your ChatGPT
            password or retrieve your ChatGPT conversations.
          </li>
          <li>
            <strong>Access checks.</strong> Invitation codes entered for
            professor activation or the tutorial are sent to the server for
            validation. The application does not save the entered code in a user
            record.
          </li>
          <li>
            <strong>Teaching content.</strong> Professors provide class names
            and descriptions, assignment topics, instructions, and deadlines.
            The application creates record identifiers, assignment-link tokens,
            and creation dates.
          </li>
          <li>
            <strong>Student writing.</strong> Students provide their name and
            essay text. Drafts contain text and formatting, the assignment
            reference, start time, and writing history. Submissions contain the
            name, essay title, final text and formatting, statistics, and
            submission time.
          </li>
          <li>
            <strong>Writing-process records.</strong> The editor records
            insertions, deletions, replacements, text positions, event timing,
            pasted text and its origins, and pauses. These records can reveal
            text later changed or removed from the final essay. Statistics
            include measures such as writing time, typing pace, revision
            activity, and paste counts.
          </li>
          <li>
            <strong>Submission device information.</strong> At submission, the
            server records an IP address and country when supplied by request
            headers, and an operating-system description derived from the
            browser’s user-agent header. These details are stored with
            submission statistics and shown to the owning professor.
          </li>
          <li>
            <strong>Feedback.</strong> Professors create highlights, selected
            quotations, comments, colours, drawing paths, and associated
            creation and update times.
          </li>
          <li>
            <strong>Direct contact.</strong> If you email the operator, your
            email address and the information in your message are used to handle
            that communication.
          </li>
        </ul>
        <p>
          Scribo has no file-upload feature. Essay text entered or pasted into
          the editor is content collected by the application. PDF, text, and
          Markdown files offered by the interface are generated as downloads in
          your browser.
        </p>
      </section>
      <section>
        <h2>3. Why the information is used</h2>
        <p>
          Sign-in information and invitation checks control access and associate
          records with the appropriate account. Teaching content provides
          assignments. Draft data lets students recover or continue work;
          revision information helps prevent conflicting saves. Submitted
          essays, process records, and feedback enable professor review, writing
          replay, statistics, and exports. Submission device information
          provides context alongside writing-process details. Contact
          information is used to respond to questions and requests.
        </p>
        <p>
          Writing records concern activity inside the essay editor. Scribo does
          not install general browsing-session recording, advertising trackers,
          visitor-analytics scripts, or a third-party error-reporting SDK. It
          does not automatically send essays to an AI API or run AI analysis.
          Hosting and authentication providers operate separately, as described
          below.
        </p>
      </section>
      <section>
        <h2>4. Who can access information</h2>
        <p>
          In the application, professors can access classes and assignments they
          own and the submissions and feedback associated with them. Other
          professor accounts are not granted access to those records. Anyone
          with an assignment link can see its topic, instructions, and deadline;
          that link does not provide access to other students’ essays or private
          account drafts.
        </p>
        <p>
          Guest drafts remain in that browser until the student submits them or
          chooses to transfer them to an account. Account drafts are available
          through the draft interface to the same signed-in account. The
          professor interface does not expose unsubmitted account drafts.
          Submitting makes the essay and writing-process information available
          to the owning professor.
        </p>
        <p>
          The operator has administrative access to application records. Hosting
          and database providers process information to supply their services. A
          person with access to your device or browser profile may also be able
          to read locally saved drafts; signing out does not erase those drafts.
        </p>
        <p>
          Professors can download annotated responses and a Markdown AI-review
          prompt containing the student’s name, essay, assignment details, and
          available process records, including submission device details in the
          statistics. Scribo generates these files locally and does not
          automatically upload them anywhere. A professor may choose to share an
          export separately; ask that professor about the recipient and purpose.
          Copies held outside Scribo are not controlled by its deletion buttons.
        </p>
      </section>
      <section>
        <h2>5. Storage and service providers</h2>
        <p>
          Scribo is hosted through OpenAI Sites on Cloudflare infrastructure.
          Server-held professor records, classes, assignments, account drafts,
          submissions, and annotations are stored in a Cloudflare D1 database.
          No file-storage bucket or upload service is connected. Browser draft
          storage is described in the{' '}
          <Link href="/policies/cookies">Cookies policy</Link>.
        </p>
        <p>
          ChatGPT provides sign-in. OpenAI and Cloudflare control parts of
          hosting, authentication, request handling, and operational logging
          outside Scribo’s application code. Their practices are described in{' '}
          <a href="https://openai.com/policies/privacy-policy/">
            OpenAI’s Privacy policy
          </a>{' '}
          and{' '}
          <a href="https://www.cloudflare.com/privacypolicy/">
            Cloudflare’s Privacy policy
          </a>
          . The application does not specify a country for physical database
          storage or configure the providers’ log and backup retention. The
          operator’s location in Ukraine does not mean that all processing takes
          place in Ukraine.
        </p>
        <p>
          The tutorial opens YouTube, and the donation and research links open
          external websites. These are outbound links, not embedded players,
          payment forms, or connected research services. Those websites receive
          your visit when you open them and apply their own policies. Interface
          icons and PDF fonts are bundled with the application; the interface
          uses system fonts.
        </p>
        <p>
          Scribo has no payment processor or subscription system and does not
          request payment-card details. Optional developer support uses
          displayed bank-transfer details; the Ukraine-support option links to
          Come Back Alive. Any transfer information handled by banks or
          recipients is outside Scribo’s application database.
        </p>
      </section>
      <section>
        <h2>6. Retention and deletion</h2>
        <p>
          There is no configured age-based expiry or automatic cleanup for
          server records. Professor approvals, classes, assignments, account
          drafts, submissions, and feedback remain until removed through the
          available controls or an operator-handled request. An assignment
          deadline does not delete its records.
        </p>
        <ul>
          <li>
            Deleting a class removes its assignments and their submissions,
            response annotations, and account drafts.
          </li>
          <li>
            Deleting an assignment removes its submissions, response
            annotations, and account drafts.
          </li>
          <li>
            Deleting an individual submission removes its response annotations.
            A saved account draft is a separate record and remains, including
            its submitted status.
          </li>
          <li>
            Professors can delete individual annotations. They can also edit
            comments, colours, and drawings.
          </li>
          <li>
            After successful submission, the writing page removes the active
            draft backup from that browser. A submitted account draft remains on
            the server. Copies in other browsers, tabs, or downloaded files are
            not centrally erased.
          </li>
        </ul>
        <p>
          Local storage has no configured timed expiry. Signing out does not
          clear browser backups or delete server records. Clearing browser site
          data does not remove server-held information. There is no self-service
          control to delete an account or an individual server draft, and no
          automatic process linking deletion of a ChatGPT account to deletion of
          Scribo records.
        </p>
        <p>
          Application deletion controls do not establish when provider-managed
          logs or backups are removed, and cannot recall exports shared by a
          professor. Contact the operator about those limits when making a
          deletion request.
        </p>
      </section>
      <section>
        <h2>7. Your choices and privacy requests</h2>
        <p>
          You may write as a guest, sign in for online saving, download an essay
          copy, or stop using the service. Professors can use the deletion
          controls described above. Students can contact their professor about a
          submission or assessment, including a correction to the name or
          content associated with it.
        </p>
        <p>
          For access, correction, a copy of your information, deletion, or
          another privacy concern, email{' '}
          <a href="mailto:solonskyi.psy@gmail.com">solonskyi.psy@gmail.com</a>.
          Include enough detail to locate the relevant account or assignment,
          such as the account email, essay topic, and approximate submission
          date. Do not send your password or invitation code. The operator may
          need to verify your connection to the records before disclosing or
          changing them, and will explain any applicable limits. Rights and
          available remedies depend on the law that applies to your situation.
        </p>
        <p>
          Requests concerning a provider’s own account or a professor’s
          independently held copies may also need to be directed to that
          provider or professor.
        </p>
      </section>
      <section>
        <h2>8. Policy updates</h2>
        <p>
          This page will be updated when Scribo’s information-handling practices
          change. The date above identifies the latest revision. Use the contact
          email above for questions about this policy or how it applies to your
          work.
        </p>
      </section>
    </PolicyPage>
  );
}
