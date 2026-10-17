## Task and developer
DEV-005 #8, Cassy / Chair 3, feature/studio-assets. Add polite, atomic live result counts required by Tyler's coordination note. Loading announces Updating asset results rather than a stale number; completed synthetic searches announce singular/plural matching assets.

## Files changed
view.js and view.test.cjs implement/check count states. Issue docs include preview and task handoff. No shared Studio files changed.

## Checks performed
41 component/worker/native/view tests pass; view syntax and exact diff/whitespace/sensitive-path checks pass. Browser synthetic no-match search shows 0 matching assets. Fake-DOM regression verifies live attributes, singular, zero and loading states. Actual screen-reader speech, High Contrast and integrated writable shell remain unverified.

## Screenshots or previews
[Result count](https://github.com/Jaxsavvy/meridian-connect-studio-build/blob/feature/studio-assets/docs/studio/assets/8/result-count-preview.png).

## Known issues and dependencies
PR #15 is merged; this is separate follow-up. Owner-published assigned branch 0d76095 synchronized with --ff-only after verifying ancestry and unchanged DEV-003 local paths. Shared mount, versioned live service, DEV-018 OS policy and distributed runtime remain pending. Task stays Blocked; no Complete or release claim.

## AI session handoff
See docs/development/handoffs/ISSUE-8-chair-3.md. Prior DEV-003 edits preserved/excluded. Existing fail-closed Upscayl gate unchanged.

## Integration checklist
- [x] Exact scoped diff and file list reviewed
- [x] Checks and test limits recorded
- [x] No shared-file edits
- [x] No secrets/customer/backend/binaries packaged
