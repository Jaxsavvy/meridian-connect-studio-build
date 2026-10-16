# PR #35 unsaved-warning evidence correction

The previous warning capture was byte-identical to the ordinary Asset view.
That image is not accepted evidence. The correction changes the synthetic
Electron harness only; it does not change the application or other chairs' work.

The corrected run and subsequent actual pixel inspection are now complete via
GitHub Actions on source correction `e72bace`. See `VISUAL_REVIEW.md` for the
run, exact commit/tree mapping, verified hashes and manual findings. The
instructions below describe reproduction; they are no longer an unperformed
capture step. Independent Tyler review remains open.

## Capture guard

The harness uses the existing synthetic Connect preload and real mounted Asset
Library. It imports/selects a synthetic file, captures the ordinary and selected
clean Asset views, edits the Display name without saving, checks the actual dirty
notice, and calls the real navigation action. It does not inject warning markup.

Before and after the warning capture it requires the same accepted project and
dirty field, a connected/visible alert fully inside the viewport, the actual
unsaved metadata warning text, and visible, enabled Keep editing and Discard
changes and leave controls. Bounds, viewport, text and dirty-field values are
recorded. The window is shown, background throttling disabled, rendering
invalidated and animation frames awaited; a warm-up frame is discarded before
the final capture. Both normal/selected baseline hashes must differ from the
warning image hash. Old warning image/metrics are removed before a new run.

The run records HEAD, its tree, a run ID and capture time, and refuses tracked
source/harness modifications or an untracked capture helper. Generated evidence
is not packaged. Keep editing must retain the draft and project; Discard must
navigate and clear the draft. A different hash is necessary but is **not visual
acceptance**; the metrics explicitly retain manual review as pending.

## Exact remaining capture and visual-review steps

On a clean checkout of the published correction on
`feature/dev-020-asset-mount`, using Node.js 24 and Linux with Xvfb:

```sh
npm ci --no-audit --no-fund
timeout --signal=TERM --kill-after=5s 95s xvfb-run -a ./node_modules/.bin/electron --no-sandbox docs/studio/integration/32/runtime-check.cjs
```

The existing `dev020-electron-smoke` Actions job runs that command on this branch
and uploads `dev020-synthetic-electron-evidence`. Inspect that run's HEAD and
`warning-capture.json` provenance against the correction commit before using it.

Open all three PNGs in `docs/studio/integration/32/renders/`:

- `asset-view-1440.png`: ordinary Asset view.
- `asset-selected-clean-1440.png`: selected asset before editing.
- `unsaved-asset-leave.png`: must visibly show the real warning sentence and both
  Keep editing / Discard controls, together with the unsaved metadata state.

Read `warning-capture.json` and `runtime-results.json`: source commit/tree,
before/after bounds/text/project/field, three distinct SHA-256 values, retained
draft and project after Keep editing, and successful discard/navigation. Record
the run URL, artifact, source commit and manual visual finding in PR #35. If the
warning pixels are absent, reject the capture even when hashes differ; rerun in
the shown isolated window and investigate rendering before requesting review.

No fresh PNG was authored in the editing environment: Electron, Xvfb and a
display server are absent. Unit/source checks do not substitute for this runtime
step or Tyler's visual re-review. Keep PRs #34 and #35 unmerged.
