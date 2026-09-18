import { instructionsText } from "../utils/assignmentInstructions";

const PROMPT_BODY =
  "Act as a senior scientific investigator of the academic integrity office. I am attaching the essay writing details with the essay text to it. Please, review it on a matter of cheating, think more. Output as a detailed report with the one-line decision at the start, use text formatting for better reading of the findings.";

function fencedBlock(language, value) {
  const content = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(content.matchAll(/`+/gu), (match) => match[0].length),
  );
  const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
  return `${fence}${language}\n${content}\n${fence}`;
}

function safeFilenamePart(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60);
  return normalized || fallback;
}

function buildPromptFile({ submission, stats, eventLog, pasteEvents, pauseEvents }) {
  const submissionDetails = {
    submissionId: submission.id,
    assignmentId: submission.assignment_id,
    studentName: submission.student_name,
    essayTitle: submission.title || null,
    assignmentTopic: submission.assignments?.topic || null,
    assignmentInstructions: instructionsText(submission.assignments?.instructions) || null,
    assignmentDeadline: submission.assignments?.deadline || null,
    submittedAt: submission.submitted_at,
  };

  return [
    PROMPT_BODY,
    "",
    "## Submission details",
    "",
    fencedBlock("json", submissionDetails),
    "",
    "## Writing statistics",
    "",
    fencedBlock("json", stats),
    "",
    "## Writing event log",
    "",
    fencedBlock("json", eventLog),
    "",
    "## Paste events",
    "",
    fencedBlock("json", pasteEvents),
    "",
    "## Pause events",
    "",
    fencedBlock("json", pauseEvents),
    "",
    "## Final essay text",
    "",
    fencedBlock("text", submission.final_text || ""),
    "",
  ].join("\n");
}

export default function AIPromptTab({ submission, stats, eventLog, pasteEvents, pauseEvents }) {
  function handleDownload() {
    const content = buildPromptFile({ submission, stats, eventLog, pasteEvents, pauseEvents });
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const student = safeFilenamePart(submission.student_name, "student");
    const topic = safeFilenamePart(submission.assignments?.topic, "essay");

    link.href = url;
    link.download = `${student}-${topic}-ai-prompt.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="ai-prompt-panel" aria-labelledby="ai-prompt-title">
      <div className="ai-prompt-intro">
        <div>
          <h2 id="ai-prompt-title">Academic integrity review prompt</h2>
          <p>
            Create a Markdown file containing the review instructions, all available writing
            records, and the final essay. Skribo does not run an AI analysis or send this data
            anywhere.
          </p>
          <p className="ai-prompt-note">
            The downloaded file contains student work and session details. Review it before
            uploading it to an AI service.
          </p>
        </div>
        <button className="filled-button ai-prompt-button" type="button" onClick={handleDownload}>
          Create .md prompt file
        </button>
      </div>
    </section>
  );
}
