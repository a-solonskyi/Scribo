export default function StartScreen({
  form,
  onChange,
  onStart,
  onResume,
  hasSavedDraft,
  message,
}) {
  const canStart = form.studentName.trim() && form.title.trim();

  return (
    <main className="start-screen" aria-label="Setup essay">
      <section className="start-intro">
        <h1>Setup essay</h1>
        {message ? <p className="session-message">{message}</p> : null}
      </section>

      <form className="start-form" onSubmit={onStart}>
        <label className="start-field">
          <span className="field-label">Essay title</span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="Enter essay title"
            autoComplete="off"
            required
          />
        </label>

        <label className="start-field">
          <span className="field-label">Student name and surname</span>
          <input
            type="text"
            value={form.studentName}
            onChange={(event) => onChange("studentName", event.target.value)}
            placeholder="Name Surname"
            autoComplete="name"
            required
          />
        </label>

        <label className="start-field">
          <span className="field-label">Subject</span>
          <input
            type="text"
            value={form.subject}
            onChange={(event) => onChange("subject", event.target.value)}
            placeholder="Subject"
            autoComplete="off"
          />
        </label>

        <div className="start-actions">
          <button className="primary-button" type="submit" disabled={!canStart}>
            Start writing
          </button>
          {hasSavedDraft ? (
            <button className="secondary-button" type="button" onClick={onResume}>
              Resume saved draft
            </button>
          ) : null}
        </div>
      </form>

      <p className="privacy-note start-privacy">
        All text stays in this browser session unless you export it.
      </p>
    </main>
  );
}
