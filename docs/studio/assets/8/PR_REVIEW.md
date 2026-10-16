## Task and developer

- DEV-005, refs #8. Cassy / Theecassycat, Chair 3; `feature/studio-assets`.
- First implementation batch: isolated Asset Library model/controller/view, replaceable named transport adapter, synthetic service and fail-closed Upscayl host boundary. Keep #8 open; this draft does not satisfy complete Connect integration or actual Upscayl evidence.

## Files changed

- New `src/renderer/studio-assets/` modules implement model/lineage, naming, scoped state, synthetic service, host adapter, view and scoped CSS.
- New `src/studio-assets/` implements injected worker validation/cancellation/registration boundary, pinned native CLI runner and bounded PNG decoder. No external binaries/models packaged or committed.
- `docs/studio/assets/8/` contains host contract, loopback demo, synthetic fixture, 28 component/worker/native tests, real CLI smoke/failure harnesses, external artifact staging script, pin/license/evidence report, screenshots and overview.
- `docs/development/handoffs/ISSUE-8-chair-3.md` records scope, tests and dependencies.
- Existing uncommitted DEV-003 planning files deliberately excluded.

## Checks performed

- `node --test docs/studio/assets/8/component.test.cjs docs/studio/assets/8/worker.test.cjs docs/studio/assets/8/native.test.cjs`: 28 passing tests. New stale-retry/list, wrong-version/wrong-asset and concurrent-saving cases pass.
- `node --check` on every new runtime JavaScript module; whitespace and exact staged path/diff checks.
- Browser synthetic import, edit, submit-review, project isolation/sign-out, retained unsaved edit, keyboard focus and download checks. Screenshot in `docs/studio/assets/8/synthetic-preview.png`.
- Real Upscayl CLI: 32x32 -> 128x128, preserved original, synthetic idempotent derivative registration; real launch cancellation/timeout, missing input/wrong pin and corrupt zero-exit/no-output rejection verified. Artifacts officially sourced and pinned outside Git; no installer run.
- Real native browser fixture: Running -> Succeeded, separate derivative/parent selection, cancelled job and unchanged version count verified. Arbitrary imports denied. See artifact report and native-preview screenshot.
- Unsaved switch UI: Keep editing retains current project/draft/focus; explicit discard clears old-project details before the next project loads. Metadata inputs disable during pending requests.
- No Connect build/package, full accessibility audit, integrated OS sandbox, authoritative service permissions or production checks. No third-party binaries/models/generated outputs committed.

## Screenshots or previews

[Synthetic development preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/synthetic-preview.png)

[Real native synthetic test preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/native-preview.png)

[Unsaved switch protection preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/unsaved-preview.png)

Run the explicit-allowlist loopback preview using the README instructions. Neutral functional styling is not Tyler's approved integrated design.

## Known issues and dependencies

Blocked for full acceptance on exact Chair 1 shared hooks/context/authoritative service contract, reusable Tyler token/component implementation, and owner-approved OS isolation/distribution policy. Tyler's issue #8 coordination supplies Command Workbench B direction/terminology; integrated surfaces remain unwired. Owner's pending PR #10 build map and DEV-007 boundary reviewed. Real CLI evidence exists separately from mock worker tests. Native runner is accurately process-scoped, not OS-enforced; integrated worker gate remains closed. No shared main/preload/API/navigation/style files touched.

Current packaging includes `src/**/*`; owner must review new runtime modules for distribution. Fixtures/tests/screenshots stay under docs outside that allowlist. Scratch retention after uncertain registration, production review/download policies and resumable wire transport remain host decisions. Project switching now has a confirmed-discard choice; shipping still requires alignment with Tyler's reusable design and approved persistence/resume contract.

## AI session handoff

Codex implemented/tested only scoped client modules and synthetic worker boundaries. See `docs/development/handoffs/ISSUE-8-chair-3.md`. Board should reflect blocked full-flow dependencies; no claim of completion or working Upscayl integration.

## Owner integration review

- [ ] Exact diff and file list reviewed by owner
- [ ] CI result and test limits reviewed by owner
- [ ] Shared-file/design/process gates approved and remaining flows verified
- [ ] Owner explicitly approves integration into `main`

Only the owner completes this section and merges.
