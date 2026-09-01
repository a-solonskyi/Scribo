import { useState } from "react";
import { Navigate } from "react-router-dom";

import { activateProfessor } from "../sites/auth";
import { ErrorState } from "./LoadingState";

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
      <div className="auth-logo">[ˈskriː.boː]</div>
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Professor access</p>
          <h1>{session ? "Invitation required" : "Sign in"}</h1>
          <p className="muted-line">
            {session
              ? `Signed in as ${session.user.email}. Enter the professor invitation code once.`
              : "Use your ChatGPT account to open the professor workspace."}
          </p>
        </div>

        {session ? (
          <form className="stack-form" onSubmit={handleActivation}>
            <label>
              <span>Invitation code</span>
              <input
                type="password"
                value={invitationCode}
                onChange={(event) => setInvitationCode(event.target.value)}
                placeholder="Invitation code"
                autoComplete="off"
                required
              />
            </label>
            <ErrorState message={error} />
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Checking" : "Open professor workspace"}
            </button>
          </form>
        ) : (
          <a className="primary-button auth-signin-link" href="/signin-with-chatgpt?return_to=/login" target="_top">
            Continue with ChatGPT
          </a>
        )}
      </section>
    </div>
  );
}
