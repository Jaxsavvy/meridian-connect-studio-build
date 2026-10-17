# Website section text formatting

Tyler DEV-006 #9, PR #39. Local UI backlog contribution.

Each section body has an explicit Plain text / Formatted text choice. Existing
records without bodyFormat retain literal plain-text output. Formatted text
supports **bold**, *italic*, paragraphs separated by blank lines, hard line
breaks, - bullet items and 1. numbered items. Native buttons insert markup around
the textarea selection; list buttons operate on complete selected lines. Focus
returns to the body. An insertion is one undoable edit; Undo/Redo, save/reopen,
checkpoints and local export retain the format and source text. Switching back
to Plain text displays the markers literally; it never deletes the source text.

This is a bounded source-text editor, not WYSIWYG or full Markdown. Nested
formatting, links, media, arbitrary HTML, headings and tables are not supported.
Raw user fragments are escaped before fixed semantic p/br/strong/em/ul/ol/li
tags are emitted. No scripts, styles, URLs, media or external dependency can be
introduced by formatting. Preview retains its empty iframe sandbox. Export uses
the exact same body renderer. Toolbar insertion rejects invalid selection ranges
and content exceeding 8,000 characters; prior draft/history/redo remain intact.

Four focused model regressions pass and the relevant local suite is 141/141.
The new real Electron path exercises native Enter, focus return, emphasis/list
insertion, undo/redo, escaped script text, preview and actual downloaded ZIP.
Exact-source CI evidence and visual review are pending at implementation publication.

No backend, bridge, dependency, permission, approval/publish or packaging change.
Human Narrator output and independent reviews remain separate. Drag/drop,
reusable global components, nested site navigation and advanced rich editing
remain explicit backlog; this slice delivers the listed text formatting only.


## Action destinations (same continuation)

The export audit found every action previously linked to an absent #contact.
Action destination now selects an actual page from this website. Stable page IDs
follow slug changes; export derives safe filenames. Removing a target clears
references in the same undoable transaction. A missing target is visible in the
editor and local readiness; that action is omitted from preview/downloads until
configured. In preview, configured actions are inert spans; exported actions use
relative HTML links. No renderer-supplied URL or external destination is accepted.
Three new regressions verify destinations, removal/undo and invalid targets.
The full relevant local suite is now 144/144. The first formatting Electron run
failed because its test embedded a newline incorrectly; corrected before this
combined verification run. No runtime success is claimed for that failed run.


## Bounded checkpoint history

The ten-entry checkpoint cap now has an explicit removal path. Remove checkpoint
opens an inline confirmation naming the snapshot and explaining that removal is
irreversible. Keep checkpoint is focused first; cancel returns to its opener.
Confirming removes only that website's snapshot. Current saved/unsaved website
and editor Undo are unaffected. Failed storage writes preserve previous history
and permit retry. Removal frees a slot and survives reopen. Three new model tests
cover slot recovery, dirty-draft/primary/history preservation and storage failure.
The full local suite is 147/147; real UI adds cancel, failure/retry and focus checks.
The native Enter test uses keydown, character and keyup; previous attempts lacked
the character event and did not activate the button. No false keyboard pass.
