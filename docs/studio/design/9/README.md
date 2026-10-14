# DEV-006 Studio implementation evidence

This directory records review evidence for the first runnable Chair 2 Studio UI slice. The implementation follows the approved **Command Workbench B — Operations** direction and uses synthetic development content only.

## Truthful scope

- Studio is a primary Connect destination and consumes `window.meridianStudioContext` for the accepted project identity.
- The Operations overview, campaign/story editor, Asset Library interaction preview, recovery states, and all nine tool entries are implemented in the renderer.
- The nine tools remain **Planned**. The editor and asset cards are explicitly synthetic, in-memory development demonstrations; they do not prove provider, persistence, permission, employee-runtime, or production behavior.
- Cassy's writable Asset Library is not mounted. Its host lifecycle and authoritative project-scoped service remain dependencies.

## Review evidence

- `studio-workspace.test.cjs` covers project switching and stale results, sign-out clearing, save/error/retry states, review semantics, asset filtering and selection/placement separation, and static accessibility/integration contracts.
- `runtime-preload.cjs` exposes synthetic, local-only Connect fixtures for the evidence run. It does not contain credentials, endpoints, customer content, or service authorization.
- `runtime-capture.cjs` loads the real Connect renderer in Electron and captures the Studio Operations, editor, Asset Library preview, recovery-state gallery, unsaved-leave dialog, and 200% zoom views. It is an evidence harness, not a packaged or production entry point.
- `renders/runtime-results.json` records programmatic viewport, horizontal-fit, nine-tool availability, accessible-button-name, and form-label checks from that isolated run.
- Runtime screenshots and their viewport details are stored under `renders/` after the isolated harness is exercised and visually reviewed.
- Employee-runtime comparison remains pending and unverified.
