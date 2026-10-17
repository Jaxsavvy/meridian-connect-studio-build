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


## Final exact-source acceptance

Executable source: c8566b6f7d408b1dd1966fff65460e896ed4c69d; source tree
074ca47ed8b0f1b02c800a8714512dcd8b6da1fe. All four workflows pass:
source 38998525617, Linux 38998525632, Windows 38998525641, cross-chair
38998525616. Relevant local suite: 147/147. Both actual Electron flows, full
native Enter activation/focus return, formatting undo/redo, inert preview,
real ZIP output, checkpoint cancel/confirm/write-failure retry and reopen pass.
Windows also passes actual OS Contrast readback/restoration (126 -> 127 -> 126),
existing NSIS build/install, installed-source match and login AX/Tab/employee gate.

Downloaded archives and SHA-256 matched GitHub:

| Artifact | SHA-256 |
| --- | --- |
| Linux 12088376176 | 950d606ebd7bbd7b0350bbe18c4f6b71306f4ce36796ce9a8682bc128da18fee |
| Windows 12088141874 | 41a9bbe1f3d50ee94e57bac100deac02674f7b1f54624e8f23d586378a1864b5 |
| Cross-chair Linux 12087854206 | 581b3e02a58ea54e31eb034e3243089b128a8025f6b2dfabf3590e1e805c56ec |
| Cross-chair Windows 12088490695 | b2db931d7900c24934e375684c361bd2ed8caeb624051061b255c9c4f5a009d7 |

Installed/capture tree matches the executable source above. Both cross-chair
archives pin that UI head and Cassy's 3fab5ef; composed tree is
9c81d49593ed1b4722dd2367d1a0b7ee965fe1d2, clean before runtime.
Independently decoded all six actual site ZIPs from Linux/Windows/composed/OS
Contrast variants: filenames/UTF-8/CRCs, semantic emphasis/list tags, escaped
script text, real index.html CTA and absence of the old #contact link all pass.
Inspected actual Linux formatting/destination/removal/preview captures, composed
Windows OS Contrast formatting/removal and standalone OS Contrast destination.
The preview visibly shows bold/italic/list output and script input as text.
The removal capture visibly shows the named irreversible action, both choices
and initial Keep checkpoint focus. No screenshot was substituted or inferred.

Historical failed runs above remain failed, not counted as acceptance. This is
local development UI evidence; human Narrator speech, independent review and
accepted service/release authority remain unverified. All PRs remain unmerged.
