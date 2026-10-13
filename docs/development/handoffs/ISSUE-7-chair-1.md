# DEV-004 Chair 1 handoff

## Task identity

- Issue: [DEV-004 #7](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/7)
- Project: [Meridian Development Command #1](https://github.com/users/Jaxsavvy/projects/1), item `PVTI_lAHODSEV684Bmo45zhAVIXU`
- Branch: `feature/studio-integration`, starting at `cd6bf77cd30265e056b72b32b53e49463abf7f40`
- Read-back fields: Chair 1 — Owner; P1 — High; Studio Foundation; Building

## Work and checks

- Added a memory-only project context and nine-tool catalogue under `src/renderer/studio-context.js`.
- Connected it to the existing authenticated project-list load, workspace selection, and sign-out. Failed refreshes clear visible project cards; stale list and workspace-read results cannot become current after a switch, newer render, or sign-out. The chat dock no longer sends a fabricated fallback project ID.
- Documented the client and permission contract in `docs/studio/foundation/7/PROJECT_CONTEXT.md`.
- Synthetic context and renderer integration tests: 17 passed with `node --test --test-isolation=none tools/studio-context/studio-context.test.cjs tools/studio-context/renderer-integration.test.cjs`. They use deferred API responses and no live service. The combined DEV-001A and DEV-004 test run passed 26 tests.
- `node --check` on the new module, `app.js`, and `project-workspace.js` passed; `git diff --check` passed.

## State and next step

This handoff was recorded before the owner-authorized feature-branch publication. Check issue #7 and the branch for the latest commit and PR. No deployment, backend, or provider operation was performed.

Next: review the exact DEV-004 diff and owner design decision before any visible Studio shell work. Runtime login and visual behavior need an authorized Connect development environment, including confirmation that live project IDs use the accepted URL-safe form. The client catalogue is deliberately Planned; backend availability and permissions are unverified. Storyboard requests and existing non-Studio mutation flows are outside this slice's project-switch and write-result audit.
