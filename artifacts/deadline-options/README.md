# Deadline interaction studies

## Liquid typography references

The latest refinement changes only the transformation. The comparison now shows the previous liquid refinement on the left and the new reference-inspired morph on the right; both use the same selected bottle, glass, stream, fill, and rim spray.

Letterforms stay readable while swelling and leaning, then gather through smooth surface-tension joins. Six small droplets pinch off and return. An opaque density contour removes exposed particle grain, and a small elastic recoil settles into the existing bottle without changing its design. **Slow motion** makes these details easier to inspect.

Motion references inspected in the browser:
- https://animationoutsourced.com/wp-content/uploads/2019/07/ezgif.com-resize-1.gif
- https://dribbble.com/shots/2589783-Liquid-Type-Animation (the original artist's animation linked by the supplied Pinterest pin)
- https://aescripts.com/media/author/author_media/animography/products/frame_by_frame_dribbble.gif

The implementation is procedural and black-and-white; no reference artwork is bundled or copied into the app.

## Refined hybrid

The selected template combines the Paper cut bottle with the Fine line glass. Open http://127.0.0.1:3000/prototypes/deadline/compare for a synchronized before/after comparison, or http://127.0.0.1:3000/prototypes/deadline?option=liquid to try the refinement in the editor.

The new morph samples the actual deadline glyphs and draws their ink into connected, curling strands that settle into the shared bottle silhouette. It does not morph through the old rectangle and stock blot outline. The stream is a solid curved ribbon whose width varies gently in motion. At the deadline the fill stays at the rim; after the deadline, short droplets sprinkle around the rim, with no long runoff or puddle. The transformation hint is removed everywhere.

**Replay both** restarts both interactions. **Slow motion** runs the transformation at 30% speed. The shared timeline controls both fill levels. The comparison's **Before** panel preserves the previous motion but uses the same selected bottle/glass combination to isolate the motion differences.

Screenshots `05-refined-motion-comparison.png` and `06-refined-overflow-comparison.png` document this revision. The original three screenshots below are retained as historical references.

## Original studies

Run `npm run dev` and open http://127.0.0.1:3000/prototypes/deadline.

These are three alternatives for review; none is enabled as the final direction on the student writing page.

- `?option=line` — Fine line: outline bottle, delicate stream, clear curved glass.
- `?option=ink` — Dry ink: rough silhouette, etched liquid, irregular glass.
- `?option=cut` — Paper cut: solid silhouette, heavy stream, faceted glass.

Click **Deadline / Time left** to dissolve the text into ink and morph that ink into the bottle. The glass appears at the bottom of the viewport. The editor remains usable during the animation. Escape or the × button restores the field and keyboard focus. Switching direction resets the transformation; **Reset field** allows it to be replayed.

The review page uses a clearly simulated 24-hour deadline and starts at 62% elapsed for comparison. The stream remains animated while the review clock is paused. **Play timeline** advances 100% in 30 seconds; the scrubber and boundary buttons show empty, full, and overflowing states. At exactly 100% the glass is full with no overflow; overflow begins above 100%.

The reusable component also supports real dates through `startedAt` and `deadline` when `progressOverride` is omitted. Progress is `(now - start) / (deadline - start)`, with the visible fill clamped to 0–1 and excess retained for overflow. No start time is invented when dates are missing or invalid. Reduced-motion preferences skip the morph and moving stream effects while keeping the fill state accurate. Animation frames and listeners are cleaned up on close and direction changes; hidden tabs pause the animation.

Screenshots `01-fine-line.png`, `02-dry-ink.png`, and `03-paper-cut.png` were captured from the running page at the same 62% fill. `04-overflow-detail.png` shows the fine-line overflow state at 118%.

Validation: utility tests for deadline boundaries and invalid intervals, targeted lint, production build, and browser checks of all three directions, the live clock, empty/full/overflow, and Escape restoration. Existing editor warnings about duplicate Underline registration and immediate rendering are unrelated to these prototypes.
