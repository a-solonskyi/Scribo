# Scribo policy implementation audit

Reviewed 16 September 2026. Operator supplied by the user: Andrii Solonskyi, Ukraine, solonskyi.psy@gmail.com. Sites ownership metadata agrees with the supplied name and email. The existing Donate panel names the same person in Ukrainian. No conflicting operator record was found.

## Evidence used

| Subject | Verified implementation | Source |
| --- | --- | --- |
| Purpose and roles | Essay assignments, student writing, process replay/statistics, professor annotations. Approved professor, signed-in student, guest student. | `src/App.js`, `src/components/StudentWritingPage.js`, `src/components/SubmissionAnalyticsPage.js` |
| Authentication | ChatGPT identity headers provide ID, email, optional name. Invitation-code check creates professor approval; student sign-in does not require professor approval. No local password registration. Tutorial uses invitation check and an outbound YouTube link. | `app/chatgpt-auth.ts`, `app/api/professor/activate/route.ts`, `app/api/tutorial/access/route.ts`, `lib/server/professor.ts`, `src/components/LoginPage.js` |
| Personal information | Professor identity; student supplied name; account ID attached to drafts; essays, rich text, writing events and timestamps, pasted text, pauses, statistics; submission IP, header-derived country and user-agent-derived OS; teaching content and annotations. | `db/schema.ts`, `app/api/submissions/route.ts`, `src/components/StudentWritingPage.js`, `src/components/EssayEditor.js`, `src/components/ProcessMetrics.js` |
| Access | Professor APIs require approval and ownership. Public assignment endpoint selects only assignment ID, topic, instructions, deadline and token. Account draft endpoint uses authenticated ID. No professor endpoint for unsubmitted drafts. | `app/api/**/route.ts`, `lib/server/data.ts`, `lib/server/student-drafts.ts` |
| Server storage | Cloudflare D1 via `DB`; Sites project configuration; no R2 binding or upload API. | `.openai/hosting.json`, `db/index.ts`, `db/env.d.ts`, `vite.config.ts`, `drizzle/*.sql` |
| Browser storage | `scribo-student-draft:{token}` and `scribo-account-draft:{encodedUserId}:{token}` in localStorage; `scribo-transfer:{token}` in sessionStorage. No timed expiry. Active local backup removed after submit; transferred guest backup removed on successful online save; marker removed after transfer or choosing existing account draft. Logout does not clear local backups. | `src/utils/studentDrafts.js`, `src/hooks/useStudentAutosave.js`, `src/components/StudentWritingPage.js` |
| Cookies | No application-written cookies. Sites/ChatGPT authentication is provider-managed, beyond this source inventory. The Vite plugin's simulated sign-in is development-only and is not evidence of production cookie names. | Source search for cookies/storage; `node_modules/@openai/sites-vite-plugin/README.md` |
| Tracking | No connected visitor analytics, advertising, third-party error-reporting SDK, or general browsing-session replay found. Educational replay is explicitly recorded editor activity. Installed packages alone were not treated as integrations. | Source/configuration/dependency search; `src/sites/*`, `src/utils/writingAnalytics.js` |
| AI and exports | Markdown prompt includes student name, final essay, assignment details, statistics (including device information), writing/paste/pause records. Generated with Blob; no AI request. PDF uses bundled pdfmake fonts; student text download is also local. | `src/components/AIPromptTab.js`, `src/utils/annotatedResponsePdf.js`, `src/components/StudentWritingPage.js` |
| External resources | YouTube tutorial, Come Back Alive donation link, Aalto research link. Outbound navigation, not embeds. Interface uses system fonts and bundled icons. | `LoginPage.js`, `Layout.js`, `StatsCards.js`, `src/styles.css` |
| Payments | Donate displays developer bank-transfer information or opens an external charity page. No checkout, subscription, recurring billing, payment processor, or refund/cancellation implementation. | `src/components/Layout.js`, API/schema/source search |
| Deletion | Class/assignment deletion cascades through related records, including account drafts. Submission deletion cascades annotations, not separate account drafts. Submitted account drafts retain submitted status. No account-deletion endpoint or scheduled cleanup. No automatic deletion when a ChatGPT account is deleted. | API DELETE handlers, `db/schema.ts`, both SQL migrations, submission transaction |
| Environment | Runtime binding `DB`; hosting `r2: null`. Tooling-only names include `CODEX_SANDBOX`, `WRANGLER_WRITE_LOGS`, `WRANGLER_LOG_PATH`, `MINIFLARE_REGISTRY_PATH`. No application AI/payment secret reference. Secret values were not used in policy content. | `vite.config.ts`, `db/index.ts`, hosting configuration |

The audit includes the pre-existing local account-draft, instructions, and deadline changes in this checkout. It does not roll back or independently redesign those features.

## Provider references reviewed

- https://openai.com/policies/privacy-policy/
- https://openai.com/policies/cookie-policy/
- https://www.cloudflare.com/privacypolicy/

These notices are linked for provider practices, not treated as proof that every provider-wide technology is deployed on Scribo. The policies do not assert a storage country, provider cookie inventory or expiry, legal basis, consent mechanism, backup deletion deadline, encryption guarantee, or certification.

## Implementation

Three explicit public App Router routes render policy content without importing the authenticated application, querying its database, or loading its session. Shared page chrome identifies the operator, update date, current document, and website return link. Next links provide policy-to-policy navigation.

The professor-only sidebar button sits directly below Donate, has a transparent background, and reuses the existing Base UI popover wrapper. Public/sign-in links use the same link component. Popover and sign-in links open new tabs with `noopener noreferrer` and a screen-reader new-tab indication. In-document navigation stays in the current tab.

## Verification

- All three direct policy URLs returned HTTP 200 and their correct heading without authentication.
- Policy navigation updated heading, current-page indicator, and URL. Browser Back, Forward, and refresh preserved the correct document.
- Unauthenticated `/api/me` returned `session: null`; classes, assignment submissions, and individual submission APIs returned 401.
- Desktop and mobile UI inspected, including 375px policy pages and 320px sign-in layout; no horizontal overflow observed. Existing application theme is light only.
- Popover tested in a temporary local professor-layout fixture without granting API access. Enter opened it and focused the first document; Tab moved through document links; Escape and Close dismissed it and restored the trigger; outside click dismissed it. Button computed background was transparent. Fixture removed before build/publication.
- All three popover links opened the matching policy in separate Chrome tabs. The public links use the same tested component and were checked for destinations and attributes; the public page has no professor policy button.
- All 24 existing tests passed. TypeScript passed. Targeted lint for every policy-related source file passed. Repository-wide lint has pre-existing errors in unrelated components and utilities.

## Separate operational decisions

1. Obtain a provider-confirmed production cookie inventory (including authenticated sessions), storage-region information if available, and log/backup retention details. The application cannot establish those guarantees.
2. Decide a server-record retention schedule and whether to add account/draft deletion controls. Currently requests are handled through the operator contact, and no timed cleanup exists.
3. Consider explicitly informing students, before writing/submission, that detailed writing history and submission IP/country/OS are available to the professor. No new consent flow or banner was added in this task.
4. Local account backups survive logout. A future shared-device cleanup feature would need a separate decision to avoid destroying unsaved work.
