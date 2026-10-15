# DEV-020 — Chair 1 integration handoff

**Issue:** [#32](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/32)  
**Branch:** `feature/dev-020-asset-mount` (started from `main` at `29a0df69c1b1497c85f671daddc3b8aaa979cc8a`)  
**Status:** Partial implementation; not ready to merge or mark Complete.

## Implemented first slice
- Added `src/renderer/studio-dev-asset-transport.js`, a narrow **synthetic only** named transport wrapping the existing Cassy `SyntheticService`. It accepts the existing five reviewed *component operation names*, checks current Connect project selection against the accepted project list, and rejects changes to current context after an async operation.
- Added `tools/studio-context/dev-asset-transport.test.cjs` to cover synthetic-mode labeling, rejected scope/operation, import/edit/search, project isolation, revocation and sign-out.
- Kept the existing DEV-008 `createAssetHost` as the project-scoped owner binding. No new renderer-selected IPC, backend route, service permission, OS process integration, storage migration or paid provider is introduced.
- Informed Tyler and Cassy of the overlap in the parent issue.

## Still required for DEV-020 acceptance
1. Wire the client into the development-only loader (`src/renderer/app.js`), after checking Tyler's currently open Website Builder PR #34.
2. Extend the host-owned view path (`StudioAssetView.mount(..., {hostOwned:true})`) without bypassing `createAssetHost`'s project scope. The standalone component expects its Controller methods and a callback for state changes; provide a narrow facade rather than granting it an independent project selector.
3. Implement the external **Keep editing / Discard** guard covering unsaved asset drafts on project switch, Studio leave, voluntary sign-out. Keep the synthetic campaign editor's existing unsaved guard functioning. Revocation and actual session loss must clear synchronously without prompt.
4. Mount Cassy's styles into the established gated renderer surface. Do not expose synthetic write actions in ordinary employee mode. Upscayl stays disabled.
5. Run focused tests plus existing Studio tests and Cassy's component/worker/view tests in an authorized local Electron development environment. Capture actual screenshots, 200% zoom, error/retry evidence, and rollback instructions.
6. Record compatibility against Tyler's pending PR #34 before merging shared renderer edits.

## Checks and verification limits
- Reviewed repository instructions, source boundaries, current `main` tree, DEV-008 host, Cassy's service/controller/view, Studio navigation, and DEV-020 issue.
- GitHub authenticated read/write access was exercised through task-branch and file creation.
- The development transport tests are **added but not executed**. This runtime cannot clone the repository because GitHub DNS is unavailable, and the connector does not execute code. Therefore: no test pass, Electron runtime, screenshot, or packaging claim.
- No employee service, persistent asset store, Core/Team Hub backend integration, or Upscayl activation was delivered.

## Security and rollback
- Only synthetic source and tests; no secrets, customer data, binary artifacts, or deployment code.
- Roll back by reverting this development transport and its tests; no persisted data or migration.
- Do not authorize real transport wiring without the restricted permission/schema and distribution review.

## Next step
Owner Chair 1 mounts this under the dev gate and adds the unsaved navigation lifecycle. Tyler PR #34 should be rechecked before touching shared Studio shell files. Keep #32 open until runtime and regression evidence exists.
