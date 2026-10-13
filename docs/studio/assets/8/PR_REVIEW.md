## Task and developer

- DEV-005, refs #8. Cassy / Theecassycat, Chair 3; `feature/studio-assets`.
- First implementation batch: isolated Asset Library model/controller/view, replaceable named transport adapter, synthetic service and fail-closed Upscayl host boundary. Keep #8 open; this draft does not satisfy complete Connect integration or actual Upscayl evidence.

## Files changed

- New `src/renderer/studio-assets/` modules implement model/lineage, naming, scoped state, synthetic service, host adapter, view and scoped CSS.
- New `src/studio-assets/upscale-worker.js` implements injected worker validation/cancellation/registration boundary; no process launch implementation or external binaries.
- `docs/studio/assets/8/` contains host contract, loopback demo, synthetic fixture, 21 component/worker tests, screenshot, overview and this review description.
- `docs/development/handoffs/ISSUE-8-chair-3.md` records scope, tests and dependencies.
- Existing uncommitted DEV-003 planning files deliberately excluded.

## Checks performed

- `node --test docs/studio/assets/8/component.test.cjs docs/studio/assets/8/worker.test.cjs`: 21 passing tests.
- `node --check` on every new runtime JavaScript module; whitespace and exact staged path/diff checks.
- Browser synthetic import, edit, submit-review, project isolation/sign-out, retained unsaved edit, keyboard focus and download checks. Screenshot in `docs/studio/assets/8/synthetic-preview.png`.
- No Connect build/package, full accessibility audit, real Upscayl invocation, service permissions or production checks. No dependencies/executables/models installed.

## Screenshots or previews

[Synthetic development preview](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/synthetic-preview.png)

Run the explicit-allowlist loopback preview using the README instructions. Neutral functional styling is not Tyler's approved integrated design.

## Known issues and dependencies

Blocked for full acceptance on exact Chair 1 shared hooks/context/authoritative service contract, reusable Tyler token/component implementation, and approved pinned Upscayl executable/model/license/device plus OS runner and robust decoder. Tyler's issue #8 coordination supplies Command Workbench B direction/terminology; integrated surfaces remain unwired. Owner's pending PR #10 build map and DEV-007 boundary reviewed. Mock image checks and simulated worker outputs do not establish real decoding, isolation or upscaling. No shared main/preload/API/navigation/style files touched.

Current packaging includes `src/**/*`; owner must review new runtime modules for distribution. Fixtures/tests/screenshots stay under docs outside that allowlist. Scratch retention after uncertain registration, production review/download policies and resumable wire transport remain host decisions. Project switches discard scoped drafts in this isolated UI; shipping requires approved discard/resume UX.

## AI session handoff

Codex implemented/tested only scoped client modules and synthetic worker boundaries. See `docs/development/handoffs/ISSUE-8-chair-3.md`. Board should reflect blocked full-flow dependencies; no claim of completion or working Upscayl integration.

## Owner integration review

- [ ] Exact diff and file list reviewed by owner
- [ ] CI result and test limits reviewed by owner
- [ ] Shared-file/design/process gates approved and remaining flows verified
- [ ] Owner explicitly approves integration into `main`

Only the owner completes this section and merges.
