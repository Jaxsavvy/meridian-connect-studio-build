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
