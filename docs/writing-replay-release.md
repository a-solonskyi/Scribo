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
