import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { activateProfessor, verifyTutorialInvitationCode } from "../sites/auth";
import { ErrorState } from "./LoadingState";

const FEATURES = [
  ["Writing replay", "Review the essay as it developed, keystroke by keystroke."],
  ["Paste detection", "See which final characters originated from pasted text."],
  ["Process timeline", "Compare writing, revision, pauses, and paste activity over time."],
  ["Professor response", "Highlight passages, comment, and draw directly on the essay."],
  [
    "Writing details",
    "Trace active and idle time, typing pace, pauses, revisions, deletions, and paste events.",
  ],
];

const MOTTO = "Evidence for thoughtful feedback.";
const TUTORIAL_URL = "https://youtu.be/fwI9-IQy-ZA";
const TYPEWRITER_START_DELAY = 350;
const TYPEWRITER_CHARACTER_DELAY = 65;

function TypewriterMotto() {
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(0);

  useEffect(() => {
    let typingTimer;
    const startTimer = window.setTimeout(() => {
      setVisibleCharacterCount(1);
      typingTimer = window.setInterval(() => {
        setVisibleCharacterCount((currentCount) => {
          if (currentCount >= MOTTO.length) {
            window.clearInterval(typingTimer);
            return currentCount;
          }

          return currentCount + 1;
        });
      }, TYPEWRITER_CHARACTER_DELAY);
    }, TYPEWRITER_START_DELAY);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(typingTimer);
    };
  }, []);

  return (
    <h1 className="auth-motto" aria-label={MOTTO}>
      {MOTTO.split("").map((character, index) => {
        const isVisible = index < visibleCharacterCount;
        const isCurrent = index === visibleCharacterCount - 1;

        return (
          <span
            className={`auth-motto-character${
              isVisible ? " auth-motto-character-visible" : ""
            }${isCurrent ? " auth-motto-character-current" : ""}`}
            key={`${character}-${index}`}
            aria-hidden="true"
          >
            {character}
          </span>
        );
      })}
    </h1>
  );
}

export default function LoginPage({ session }) {
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);
  const [tutorialCode, setTutorialCode] = useState("");
  const [tutorialError, setTutorialError] = useState("");
  const [tutorialLoading, setTutorialLoading] = useState(false);

  useEffect(() => {
    if (!tutorialDialogOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setTutorialDialogOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tutorialDialogOpen]);

  if (session?.approved) return <Navigate to="/dashboard" replace />;

  async function handleActivation(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await activateProfessor(invitationCode);
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openTutorialDialog() {
    setTutorialCode("");
    setTutorialError("");
    setTutorialDialogOpen(true);
  }

  function closeTutorialDialog() {
    if (tutorialLoading) return;
    setTutorialDialogOpen(false);
  }

  async function handleTutorialAccess(event) {
    event.preventDefault();
    setTutorialError("");
    setTutorialLoading(true);
    try {
      await verifyTutorialInvitationCode(tutorialCode);
      window.location.assign(TUTORIAL_URL);
    } catch (err) {
      setTutorialError(err.message);
      setTutorialLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <main className="auth-main">
        <div className="auth-logo">[ˈskriː.boː]</div>
        <div className="auth-intro">
          <TypewriterMotto />
          <button className="auth-tutorial-button" type="button" onClick={openTutorialDialog}>
            Watch tutorial
          </button>
        </div>
        <div className="auth-features" aria-label="Scribo features">
          {FEATURES.map(([title, description]) => (
            <section className="auth-feature" key={title}>
              <h2>{title}</h2>
              <p>{description}</p>
            </section>
          ))}
        </div>
      </main>

      <aside className="auth-panel">
        <h2>{session ? "Invitation required" : "Sign in"}</h2>
        <p className="auth-description">
          {session
            ? `Signed in as ${session.user.email}. Enter the professor invitation code once.`
            : "Open your classes, essay folders, submissions, and responses."}
        </p>

        {session ? (
          <form className="auth-invitation-form" onSubmit={handleActivation}>
            <label>
              <span>Invitation code</span>
              <input
                type="password"
                value={invitationCode}
                onChange={(event) => setInvitationCode(event.target.value)}
                placeholder="Invitation code"
                autoComplete="one-time-code"
                required
              />
            </label>
            <ErrorState message={error} />
            <button className="auth-submit-button" type="submit" disabled={loading}>
              {loading ? "Checking" : "Open professor workspace"}
            </button>
          </form>
        ) : (
          <Link className="auth-signin-link" to="/signin-with-chatgpt?return_to=/login" target="_top">
            Continue with ChatGPT
          </Link>
        )}
        {!session && (
          <p className="auth-privacy">
            Professor access only. Student writing links remain open without a professor account.
          </p>
        )}
      </aside>

      {tutorialDialogOpen ? (
        <dialog
          className="modal-backdrop auth-tutorial-backdrop"
          open
          aria-labelledby="tutorial-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            closeTutorialDialog();
          }}
        >
          <section className="modal-panel auth-tutorial-dialog">
            <header className="auth-tutorial-dialog-header">
              <h2 id="tutorial-dialog-title">Watch tutorial</h2>
              <button className="text-button" type="button" onClick={closeTutorialDialog}>
                Close
              </button>
            </header>
            <p>Enter the invitation code to open the Scribo tutorial.</p>
            <form className="auth-tutorial-form" onSubmit={handleTutorialAccess}>
              <label>
                <span>Invitation code</span>
                <input
                  type="password"
                  value={tutorialCode}
                  onChange={(event) => {
                    setTutorialCode(event.target.value);
                    setTutorialError("");
                  }}
                  placeholder="Invitation code"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </label>
              {tutorialError ? <p className="auth-tutorial-error">{tutorialError}</p> : null}
              <button className="auth-submit-button" type="submit" disabled={tutorialLoading}>
                {tutorialLoading ? "Checking" : "Open tutorial"}
              </button>
            </form>
          </section>
        </dialog>
      ) : null}
    </div>
  );
}
