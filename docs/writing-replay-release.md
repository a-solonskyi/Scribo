# Writing replay correctness release

The pre-change project was committed and pushed to GitHub as `feb30f3b443f5f84bc6dc76f224e761573f6d8f3`.

Steps 1–5 ship together:

- Text and character-origin tracking use one bounds-checked splice, including replacement pastes.
- Submissions retain all events in a versioned gzip encoding. Existing JSON rows still load. Payload and stored-row byte limits fail explicitly and leave the student's draft available.
- New events have continuous sequence numbers and monotonic session timing, resumed from the persisted history. Legacy events retain array order; backward timestamps are clamped for presentation, without reordering edits.
- Both submission paths validate reconstruction and preserve inconsistent evidence with an incomplete status. Reads validate legacy records too. The professor can still read the essay when accurate replay is unavailable.
- Account submission checks that essay and events belong to the flushed draft revision.

Verification: 36 unit tests, 15 audit reproduction checks, and four local HTTP integration scenarios pass. Integration covers guest/account submission with 5,002 events, gzip storage and reads, duplicate account retry, stale draft rejection, incomplete-history preservation, old JSON records, and unauthenticated access rejection. TypeScript passes. Browser verification confirms replacement-paste replay ends at `Hello earth`, and incomplete history displays a warning while preserving the essay.

No destructive database migration is needed for the storage format change. Older application versions cannot read the new compressed history format, so any rollback must retain the new decoder or convert these records losslessly first.

The original audit documents pre-fix behavior. Its reproduction script now expects all events to be preserved and passes. Recovery of older submissions and playback optimization follow this release separately.

## Recovery and performance follow-up

The correctness release was published successfully as Site version 26, from `971a94e27d2bc8253099ddeceb72f08ec5f2fdfa` (the same tested source tree as `41ee0a2d`, with deployment history merged).

The follow-up adds a professor-only **Check writing replays** page. Its read-only check pages through the professor's submissions five at a time. A repair is offered only for one complete account draft matching assignment, submission timestamp, student name, and final essay text. Repair rechecks the candidate, updates only the process history/statistics, and retains losslessly encoded original history/statistics/paste/pause fields in `stats_json.replayRecovery.backup`. Conditional updates reject concurrent changes; repeated recovery of an already complete history is a no-op. Backups remain server-side. Missing or ambiguous histories are left unchanged.

Playback builds a bounded checkpoint index once, updates paste-origin ranges with the same splice as text, and resumes from a nearby checkpoint or the previous frame. Its monotonic clock survives render delays, pause/resume, speed changes and seeking. In a local synthetic benchmark of 6,000 events and 100 seeks, full text/origin reconstruction took about 563 ms; building the index took 1.7 ms and indexed seeks took 0.5 ms. Every text result matched. This measures the reconstruction functions, not full browser rendering.

Follow-up verification: 40 unit tests and five local HTTP integration scenarios pass, including recovery matching, retained backups, safe retry and authorization. Browser verification restored a damaged local fixture and showed one recovered history. Production recovery requires the professor's signed-in session; no automatic inference or destructive replacement is performed for histories without a verified source.
