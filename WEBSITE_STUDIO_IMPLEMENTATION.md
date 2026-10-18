# Website Studio technical implementation

## Latest local review — October 18, 2026

The ordered review is on `codex/studio-thirty-checks`, based on PR #39
`c5a205c`. Its uncommitted changes are separate from published PR evidence.
See `docs/studio/design/9/ORDERED_REVIEW.md` and `ORDERED_READINESS.md`.
The last published verified source is `9f21362` (192 local / 219 composed tests);
`CREATION_AND_CATALOGUE_INTEGRITY.md` records exact runs and limits.
Older source IDs, test totals and package results below are historical milestones,
not verification of the current uncommitted source. Local pages, nested navigation,
linked sections, device previews and whole-site ZIP are implemented. Authoritative
services, media placement, provider AI and release acceptance remain open.


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
