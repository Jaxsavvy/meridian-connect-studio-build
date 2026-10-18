# Website Studio technical implementation

## Current ordered-review delivery — October 18, 2026

The ordered review is published on existing PR #39. Source008c9ee passed
source/Linux/cross-chair/Windows-installed verification. This branch also
contains the final long-name step/save-status refinement; current PR checks
track that revision. See `docs/studio/design/9/ORDERED_DELIVERY.md` for exact
source trees, artifact hashes, screenshots, board state and remaining gates.
Earlier source IDs/test totals/package results below retain their historical
scope. Local Website data is not authoritative team storage or release acceptance.

## Current implementation record — 2026-10-17

PR #39 remains the combined, unmerged review lane. Current executable source
`e665915dff8312aa59088b96083e1b37eaf1c3d4` has 174 passing local tests.
Current features, exact-source runtime evidence and limits are recorded in
`docs/studio/design/9/RECOVERY_CATALOGUE.md`, `LOCAL_DRAFT_INTEGRITY.md`
and `CONTINUATION_ACCEPTANCE.md`.
`REPOSITORY_TASK_AUDIT.md` records the fresh build-wide audit and concrete
cross-chair findings. The milestone records below retain their original scope;
their older source IDs/test counts are not current-head claims.

## Implemented milestone

The first Website Builder milestone adds a development-only working surface to the existing Meridian Studio shell. It reuses the accepted Connect project context and keeps ordinary employee mode closed.

The new model supports:

- creating and reopening multiple website projects per Meridian project;
- persistent local save with primary, pending, and backup recovery copies;
- editable client brief;
- real sitemap pages with unique safe slugs;
- reusable page sections and content editing;
- model-backed responsive HTML preview;
- per-page standalone HTML download and programmatic whole-site output;
- bounded undo/redo;
- save-failure preservation and cross-project isolation.
- explicit unsaved-change protection for leaving Studio, project switching, and sign-out.

`src/renderer/app.js` loads the builder only inside the existing development gate. `studio-shell.js` supplies the employee-facing workflow and sandboxed preview. `website-builder.js` remains environment-neutral so its data, validation, persistence, preview, and export behavior can be tested without Electron.

## Intentional limits

This is a functional local development capability, not a claim of production service integration. The application does not yet have authoritative server persistence, asset placement, provider-backed AI, publishing, deployment, collaboration, full-site UI packaging, or production authorization evidence. Those boundaries remain explicit rather than simulated.
