# Nested Website navigation

Tyler DEV-006 #9 / PR #39. Existing pages remain top-level by default.

The sitemap now supports parent selection and up to three navigation levels.
Home remains top-level. Controls omit self/descendants and any move that would
exceed the depth limit. Model/import/export validation independently rejects
cycles, unknown parents, invalid parent types and nested home. Rejected edits
retain undo/redo. Move up/down reorder siblings, not unrelated parent groups.

Removing a parent promotes its immediate children to the removed page's parent;
descendants and content remain intact. Undo restores the hierarchy and affected
action links. Parent changes are undoable and survive save/reopen/checkpoints.
The sitemap labels levels and indents child pages without a custom keyboard tree.
Native buttons/selects retain keyboard behavior and explicit focus treatment.

Preview and export emit semantic nested ul/li navigation. All groups remain
visible; no hover-only dropdown or client script. Preview labels stay inert in
the existing empty-sandbox iframe. Export links use the same flat validated HTML
filenames, so nesting does not relocate files or break existing action targets.

Three model regressions pass; relevant local suite is 150/150. Actual Electron
adds three-level creation, focus retention, excluded invalid parent options,
remove/promote/undo and final Home -> Services grouping in preview and actual ZIP.
Exact-source Linux/Windows/composed runtime and visual acceptance are pending.

No external service, URL, raw HTML, dependency, bridge, package or employee-mode
change. Human Narrator and independent reviews remain separate. Drag/drop,
shared global components and advanced rich/WYSIWYG editing remain backlog.
