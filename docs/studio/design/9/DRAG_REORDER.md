# Website drag reordering

DEV-006 #9 / Chair 2. Local UI only; no transport, dependency or package change.

Page buttons can drag above/below siblings. Parent assignment remains explicit
through Navigation parent. Section handles drag above/below sections in the open
page. Indicators show insertion side. Reordering keeps content and is one
undoable edit. Invalid/cross-parent/cross-page drops do not mutate drafts, and
no-op drops preserve redo. A drag is scoped to its source website/context/page;
external transferred content is never interpreted as a command or file.

Keyboard users retain Move up/down. Activating a section drag handle focuses an
available Move control and announces that alternative. Dropped items regain
focus. Native draggable HTML requires no new editor dependency or scripting in
exported pages. Preview/export reflect the same model order.

Two model regressions pass; relevant local suite 152/152. Real Electron tests use
constructed renderer DragEvent sequences through actual mounted listeners,
assert before/after indicators, page/section order, focus return, Undo and ignored
foreign data. A separate native Enter sequence verifies keyboard handle use.
This evidence does not claim real OS mouse/touch dragging, auto-scroll or human
screen-reader acceptance. Those observation limits remain explicit.

Exact-source runtime/visual verification is pending implementation publication.
Nested-navigation runtime at 68d0690 passed source/Linux/Windows/cross-chair jobs;
new source needs its own run. All PRs remain unmerged.
