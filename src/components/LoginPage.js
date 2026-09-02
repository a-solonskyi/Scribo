import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { activateProfessor } from "../sites/auth";
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

function TypewriterMotto() {
  const textRef = useRef(null);

  useEffect(() => {
    const textNode = textRef.current;
    if (!textNode) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      textNode.textContent = MOTTO;
      return undefined;
    }

    let characterIndex = 0;
    let typingTimer;
    const startTimer = window.setTimeout(() => {
      typingTimer = window.setInterval(() => {
        characterIndex += 1;
        textNode.textContent = MOTTO.slice(0, characterIndex);
        if (characterIndex >= MOTTO.length) window.clearInterval(typingTimer);
      }, 65);
    }, 350);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(typingTimer);
    };
  }, []);

  return (
    <h1 className="auth-motto" aria-label={MOTTO}>
      <span className="auth-motto-reserve" aria-hidden="true">
        {MOTTO}
      </span>
      <span className="auth-motto-typed" aria-hidden="true">
        <span ref={textRef} />
        <span className="auth-motto-caret" />
      </span>
    </h1>
  );
}

export default function LoginPage({ session }) {
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="auth-screen">
      <main className="auth-main">
        <div className="auth-logo">[ˈskriː.boː]</div>
        <div className="auth-intro">
          <TypewriterMotto />
          <button className="auth-tutorial-button" type="button">
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
          <a className="auth-signin-link" href="/signin-with-chatgpt?return_to=/login" target="_top">
            Continue with ChatGPT
          </a>
        )}
        {!session && (
          <p className="auth-privacy">
            Professor access only. Student writing links remain open without a professor account.
          </p>
        )}
      </aside>
    </div>
  );
}
