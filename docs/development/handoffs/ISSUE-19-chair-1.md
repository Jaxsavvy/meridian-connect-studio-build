# DEV-010 — Chair 1 Studio asset contract handoff

## Identity and state

- Issue: [DEV-010 #19](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/19); existing Project #1 item `PVTI_lAHODSEV684Bmo45zhAWIKU`.
- Chair: Chair 1 — Owner. Project status: Building. Priority: P1 — High. Module: Asset Library & Librarian. Read back on 2026-10-15.
- Task branch: `task/dev010-asset-contract-v1`; [draft PR #36](https://github.com/Jaxsavvy/meridian-connect-studio-build/pull/36). Implementation commit `cd9b8088bc404d10c0cdbcb7c0cab356abe8d199`.
- Scope: public-safe Connect contract and test reference only. Restricted Team Hub implementation remains separate and unmounted.

## Work and evidence

- The test reference now validates the bounded Studio Files metadata and review history event shapes, converts metadata history to Cassy's current Asset Model fields, and retains validated review events. Foreign version references, unexpected internal fields, and unsupported history sizes fail closed.
- Updated `docs/studio/integration/19/ASSET_SERVICE_V1_CONFORMANCE.md`, `tools/studio-context/asset-v1-contract.cjs`, and its focused test file. No shared renderer, Electron bridge, package inputs, or other chairs' files changed.
- `node --test --test-isolation=none tools/studio-context/asset-v1-contract.test.cjs`: 10 pass. `node --test --test-isolation=none tools/studio-context/*.test.cjs`: 33 pass. `node --check` on both changed JavaScript files and `git diff --check`: pass.
- [Connect source checks](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38810642974) passed at the implementation commit. Exact changed-file list and synthetic fixture scan were reviewed; no private source, credentials, customer data, or personal paths were added.
- The separate private unmounted Studio Files stage last passed 78 synthetic A/B checks. This PR's mapper has not been exercised against a mounted service. The earlier combined PR #33/#34/#35/#36 run predates the history-mapping commit and is historical evidence only.

## Remaining gates

- Task 01 remains PARTIAL; loaded bytes in the running Team Hub process and a live Studio asset route are unverified. Task 02 remains a review draft. DEV-010 is open and Studio Assets stay Unavailable.
- Cassy's requested review and adapter/controller tests must cover page state, exact hydration, history, conflict, unknown outcome, and revoked scope. Her branch was not edited here.
- DEV-011 must settle explicit project grant administration, reviewer/self-review and export authority. The restricted service owner must set media, quota, history paging, cleanup, transfer, backup, and retention policies. Transfer-time revocation and host-owned safe save remain unverified.
- Next: review Cassy's feedback on PR #36, reconcile any accepted wire changes with the private stage, and run the draft conformance cases against an approved isolated service. Keep the PR draft and board item Building until those gates are met.

No live service restart, production write, merge, deployment, paid call, or availability change occurred.
