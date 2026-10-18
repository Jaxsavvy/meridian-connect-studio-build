# Website Studio recovery and delivery

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

## Earlier continuation

PR #39 (`feature/tyler-dev006-combined`) is the current combined review lane.
Current source `837559b` completes local page/section management, safe global
styles, multi-page preview and whole-site ZIP download. Fresh 127-test Linux,
78-test Windows, actual OS Contrast and installed-app evidence is in
`docs/studio/design/9/LOCAL_WEBSITE_COMPLETION.md`; all PRs remain unmerged.
See `docs/studio/design/9/DEV006_VERIFICATION.md`, `WINDOWS_REVIEW.md` and the
Chair 2 handoff for current source/Windows evidence and exact remaining gates.
The source below records the initial #34 milestone and is retained as history.
`npm run dev` does not provide a fake or authorized service login: the current
synthetic Windows reviewer uses the separate command documented in
`WINDOWS_REVIEW.md`. Do not test against production accounts or install over an
existing employee app. All current PRs remain unmerged by user instruction.

## Repository state

- Repository: `https://github.com/Jaxsavvy/meridian-connect-studio-build.git`
- Base: `main` at `29a0df6`
- Working branch: `feature/tyler-website-studio-ui`
- Implementation commit: `fe02832` — persistent Website Builder foundation, verification evidence, and delivery documentation.
- Reported prior branch/commit: `feature/tyler-website-studio-ui` / `52daa2f` were not present on GitHub or in located local Git object stores at audit time.
- Reported `Website_Studio_Delivery.zip` and `Website_Studio_Publication_Guide.md`: not located.

## Recovery decision

Current `main` was cloned into a new writable task folder. Existing merged Studio, project-context, accessibility, and Asset Library work was retained. No history was reset, rewritten, or force-pushed. The missing reported commit was not fabricated or substituted.

## Reproduction

Use Node.js 24. Install the locked dependencies with `npm ci`. Run the Node tests listed in `WEBSITE_STUDIO_TEST_REPORT.md`. Launch the isolated development client with `npm run dev`; Website Studio remains unavailable in ordinary employee mode by design. Packaging uses the existing `npm run build` script and has not yet been verified for this branch.

The unsigned NSIS packaging command completed successfully. The installer was not executed or distributed, and generated `dist/` files are ignored rather than committed.

The feature branch was published successfully to `origin/feature/tyler-website-studio-ui`. [Pull request #34](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/34), titled **DEV-006: add persistent Website Builder foundation**, is open against `main`. Its description records the exact file scope, tests, screenshots, known limits, AI handoff, and incomplete review/dependency checklist. GitHub reports that `source-checks` passed and that the branch has no merge conflicts. Final merge, installer execution, and production distribution remain outside this delivery step.
