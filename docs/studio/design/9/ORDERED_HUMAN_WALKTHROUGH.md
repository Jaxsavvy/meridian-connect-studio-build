# Human accessibility and native interaction walkthrough

Prepared for issue9; no human pass claimed. Use WINDOWS_REVIEW.md for the
existing isolated synthetic launcher. Tester records exact commit plus local
diff, Windows/Narrator version, scaling, window size, theme and date. Do not use
production accounts or customer data. Restore the original theme afterward.

1. With Narrator running, Tab from Studio navigation into project selection;
   confirm announced name/current project and no background login navigation.
2. Create a synthetic website. Hear labels for brief fields; change audience.
   Confirm unsaved status, current page/step and discoverable Save control.
3. Scroll deep in Edit. Reach Save without pointer; activate Website steps;
   verify current-step focus is visible and not covered by the sticky bar.
4. Use Shared sections, a section shortcut and Saved checkpoints. Confirm focus
   lands on the intended heading/field; saved prerequisite is understandable.
5. Open an unsaved-leave dialog. Hear its title, explanation and three choices;
   test Tab/Shift+Tab wrapping, Escape/cancel and exact focus return. Attempt
   close/reload; save/discard, then repeat closure as the message instructs.
6. Save, checkpoint, edit, Undo/Redo and restore. Confirm announcements make sense
   without seeing the screen. Exercise retry failures only with synthetic fixtures.
7. At200% zoom and a small window, repeat shortcuts/save/dialogs. Note clipping,
   obscured focused controls, horizontal scrolling and long-name readability.
8. Enable an actual Windows Contrast theme using Windows settings; repeat and
   record theme name, visible focus, disabled controls and legibility. Emulation
   is separate evidence. Restore original theme and verify restoration.
9. With a real pointer, drag a page among siblings and a section before/after
   another; test near viewport edges and cancelled drags. Compare Move controls,
   Undo/Redo and invalid cross-parent drops. Synthetic DragEvents do not pass this.
10. Reopen saved work, switch projects and sign out. Confirm context cleanup and
    truthful local/session-only labels. No authoritative service acceptance here.

Record per step: expected result, observed speech/behavior verbatim, pass/fail/
not tested, exact action to reproduce, and screenshot if useful. Send observations
to existing issue9 when authorized; independent review must come from another
person. Preparing this walkthrough does not constitute those observations.

## Checkpoint recovery and storage-conflict additions

With a facilitator-provided synthetic fault session, open checkpoint history
that cannot be read. Confirm Narrator announces unavailability, not an empty
list; focus Retry, verify visibility at200%, and activate it. On failure the
current unsaved brief must remain. After the facilitator restores the fixture,
retry should reveal retained history and return focus to the checkpoint heading.
Do not edit real application storage to manufacture this case. If no synthetic
fault session is supplied, record the step as not tested.

For a supplied synthetic recovery-slot conflict, confirm Save explains that
existing records were kept and offers Save separate copy. Confirm that path
keeps current edits under a separate identity. Record observed speech, control
labels, focus and visible boundaries; do not infer a human pass from captures.
