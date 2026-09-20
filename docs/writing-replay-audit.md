# Writing recording and replay audit

Audited 2026-09-20 against the current working tree. Scope: editor updates, event generation, guest/account drafts, submission persistence, replay, and paste highlighting. No production records were inspected and no application behavior was changed.

**The strongest explanation for the reported symptom is destructive event trimming during submission. A second independent bug mishandles replacement pastes. Both reproduce with the current functions without waiting through playback.**

## Why the essay can be correct while replay is corrupt

The editor supplies complete text and HTML on each update. `StudentWritingPage.js:192–205` saves those values separately from the incremental history. At submission, `StudentWritingPage.js:312–339` sends complete `final_text` and `stats_json.finalHtml`, but sends `trimEventLog(eventLog)` as the replay history. Both authenticated and guest submission paths persist these separate fields (`app/api/submissions/route.ts:99–126`).

The analytics page initially displays the complete saved essay. Touching any replay control switches it to text reconstructed from events (`SubmissionAnalyticsPage.js:98–109`). This explains the difference between a correct essay and a mixed-up replay.

## Findings

### 1. P1 — Submission discards operations needed by later edits

Location: `src/utils/eventCompression.js:1–14`; caller: `src/components/StudentWritingPage.js:312`.

Above 4,000 events, `trimEventLog` retains paste/delete/replace events and only the latest inserts that fit the remaining slots. These are position-dependent edits, so earlier inserts cannot be removed without invalidating subsequent positions. No baseline snapshot or position remapping accompanies the retained events. Replay nevertheless starts from an empty string.

Reproductions:

- 3,999 and 4,000 sequential insert events replay correctly after submission trimming.
- 4,001 insert events lose the first character during submission.
- A simulated 25-minute session with 5,002 events, including a deletion and an insertion at the beginning, replays correctly from the original history. Submission retains 4,000 events; the resulting replay contains 3,994 characters instead of the expected 4,996, with the wrong beginning and edits applied against the wrong document.

This is an event-count threshold, not a 20-minute timer. At 200 text updates per minute, 4,000 events correspond to 20 minutes. The actual threshold in time depends on the writing pattern. Corruption is already present in the submitted history and can be observed by skipping to the end.

The trimmed history also feeds submission statistics, charts, and AI exports, so early activity and some derived metrics can become inaccurate.

Recommended correction: preserve every text operation in its original order. Use lossless encoding or ordered storage chunks with explicit size handling. If checkpoints are introduced for seeking, retain the earlier operations needed for full historical replay; a checkpoint alone cannot restore discarded writing history.

### 2. P1 — Replay ignores deletion when a paste replaces selected text

Location: `src/utils/replayEngine.js:6–18`; event generation: `src/utils/writingAnalytics.js:68–82`.

The recorder correctly includes both inserted text and `deleted_character_count` when the user pastes over a selection. It labels the event `paste`. The replay engine applies deletion only for `delete` and `replace`; a `paste` falls through to insertion without deletion.

Reproduction: type `Hello world`, select `world`, and paste `earth`. The recorded event has position 6 and deletion count 5. The actual essay is `Hello earth`; replay produces `Hello earthworld`. Typing an exclamation mark next produces `Hello earth!world` in replay. Subsequent positions refer to the real editor text, so corruption can compound.

This also affects any replacement classified by the 80-character bulk-insert fallback, even when there was no clipboard paste. A replacement with 80 `N` characters leaves `old text` appended in the reproduction.

Recommended correction: apply the recorded splice—position, deletion count, inserted text—for every supported text-change event. Treat paste classification as origin metadata. Share this implementation with highlighting: `pasteHighlighting.js:296–306` already applies the deletion for a paste, so the two reconstruction paths currently disagree.

### 3. P2 — Trimming changes edit order when timestamps are equal

Location: `src/utils/eventCompression.js:4–13`.

Trimming partitions edits into separate arrays, concatenates non-insert events before inserts, and sorts only by timestamp. An insert followed by a delete or replacement in the same millisecond can consequently be replayed in the opposite order. There is no sequence number to restore causality.

A 4,001-event reproduction, with an initial insert and replacement sharing a timestamp, ends empty before trimming and ends with `B` after trimming. In this case **all 4,001 events survive**, isolating the ordering defect from missing-event corruption.

That case also exposes a size-limit defect: when `remainingSlots` is zero, `.slice(-remainingSlots)` is `.slice(0)`, which retains every insert. At least 4,000 non-insert events therefore bypass the intended cap. Keeping all non-insert events also cannot enforce a cap when those events alone exceed it.

Recommended correction: preserve append order and record a persistent sequence number. Do not partition text operations by event type. Eliminate destructive trimming rather than only correcting its zero-slot branch.

### 4. P2 — Wall-clock timestamps can reorder a complete history

Locations: `src/components/StudentWritingPage.js:192`; `src/utils/replayEngine.js:22`.

Recording uses `Date.now() - startedAt`; replay sorts by that value. There is no monotonicity check. If the clock moves backward, or a continued draft moves to a device with a sufficiently different clock, a later operation can sort before the operation whose document it depends on.

The conditional reproduction records `a` at 100 ms, then inserts `b` at the beginning at 50 ms. The actual text is `ba`; replay produces `ab`.

The reorder is confirmed for non-monotonic input; the audit does not establish that a clock change occurred in the reported session. Recommended correction: use sequence order for causality, monotonic elapsed time within each session, and an explicit persisted offset on resume. Treat wall-clock time separately from operation ordering.

## Factors that conceal or amplify the problem

- **No replay integrity check.** `applyWritingEvent` silently clamps invalid positions. The recorded `current_text_length` is unused by replay, and submission does not verify reconstructed text against `final_text`. Missing operations therefore turn into plausible-looking scrambled text instead of a detected incomplete history. Validate positions, deletion bounds, per-event lengths, and final equality; equal length alone does not prove equal content. Preserve the essay even if history fails validation, and identify the replay as incomplete.
- **Repeated work grows with history.** Each playback update sorts and replays from the beginning. Highlighting separately reconstructs text and a character-origin map. The analytics page also recomputes paste-related data on each update. These paths can cause stuttering for long histories; no browser performance profile was taken, so this is a code-level performance risk rather than a measured cause of text corruption.
- **Playback timer drift.** The interval effect depends on `timeMs` and restarts after each update (`ReplayPlayer.js:60–75`). Render/effect overhead is excluded from each newly anchored interval, potentially slowing playback. It also uses the wall clock. This affects timing; it does not explain deterministic wrong text at a fixed timestamp. Keep a stable monotonic playback anchor and use cached checkpoints for efficient seeks.
- **Recording overhead.** Local backups serialize the complete draft after changes; account comparison also serializes full history (`useStudentAutosave.js:41–51`, `studentDrafts.js:32–37,58–68`). This can become expensive, but this audit did not demonstrate an event being dropped by that mechanism.

## Checks and limitations

Existing suite: `npm test` — **24 passed**. It covers draft concurrency, lossless draft encoding, paste classification, and origin tracking, but does not cover replay reconstruction or submission trimming.

Run the read-only reproduction from the repository root:

```sh
node docs/writing-replay-reproduction.mjs
```

Current result: **15 checks, 7 passed, 8 failed invariants**. The script intentionally exits with code 1 while defects remain. Multiple failing checks exercise the same root cause; this is not eight independent bugs. It uses synthetic text and does not read or alter student data.

Passing controls include the full 25-minute history, lossless account-draft encoding/decoding, repeated forward/backward seeks, and equal timestamps before submission trimming. Replay reconstructs from scratch on every call, so repeated playback does not itself accumulate text mutations. There is no 20-minute content-changing branch in the inspected replay code.

The long-session test advances recorded timestamps; it is not a real-time browser soak test. Browser-specific input handling, actual device clock changes, deployed-version differences, and a particular affected submission remain unverified.

## Existing submissions and repair order

1. Correct replacement-paste replay and preserve the complete ordered history for new submissions, with storage-size handling. Add regression coverage at 3,999/4,000/4,001 events and for paste replacement, bulk replacement, later edits, Unicode, paragraph boundaries, undo/redo, seeks, and resumed drafts.
2. Add integrity validation and report incomplete history explicitly. Checkpoint/caching optimizations should use the same validated splice logic as text and origin reconstruction.
3. Assess affected saved submissions. For accounts, the submission path marks `student_drafts` submitted without deleting `draft_json`; that draft may retain the complete history. Compare the corresponding draft against the submission before considering repair. Guest local drafts are removed after successful submission (`StudentWritingPage.js:342–343`).
4. An existing complete log with the paste bug can be replayed correctly after fixing the engine. A log missing earlier operations cannot, in general, be reconstructed faithfully from final essay text alone. Preserve any recoverable full draft before modifying saved records.
