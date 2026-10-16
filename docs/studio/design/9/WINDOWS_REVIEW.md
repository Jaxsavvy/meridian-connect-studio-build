# DEV-006 Windows verification and human test request

Task owner: Tyler (`tylerjonesprofessional`), existing issue #9 and PR #39.
Requested independent Windows tester: Theecassycat; alternate tester/resource
coordination: Jaxsavvy. A posted request is not an accepted booking or a pass.
Record the tester's confirmation and results on **existing issue #9**; no
duplicate issue or Project item is needed.

## Automated Windows lane

Verified run: [38964410689](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/38964410689), executable source `837559b`, artifact `12073134702`.
78 Windows tests, actual guided/Asset flows, actual ZIP download, OS Contrast/restoration and the
installed package checks below pass. Raw record and image hashes:
`combined-evidence/local-website-completion.json`. Prior milestone remains in
`combined-evidence/windows-verification.json`. This is not a human Narrator pass.

`Windows Studio verification` runs on PR #39's combined branch. It runs
renderer/context tests, both real shown-window Electron flows on Windows, the
existing NSIS build without publishing, silent installation on the disposable
runner, and the installed executable with isolated app data. The installed
test compares packaged `src/` and safe default settings byte-for-byte with
the checked-out source; checks the ordinary login, no remembered session, no
development bypass, unavailable Studio gate and rejected programmatic route;
and records actual Tab traversal plus the Chromium accessibility tree.

The separate OS Contrast step uses Win32 `SPI_GETHIGHCONTRAST` /
`SPI_SETHIGHCONTRAST` on the disposable runner, reads the enabled flag back,
requires Electron's native OS setting and the renderer's forced-color query
to be active **before any emulation**, then repeats the full guided flow and
restores/readbacks the original flags in `finally`. Its captures and metrics
are separate from normal media emulation. The raw scheme pointer returned by
Windows is copied without freeing Windows-owned memory.

Installed evidence exposed underlying workspace navigation behind login in the
accessibility tree. The renderer now starts authenticated UI roots inert and
keeps them inert at sign-out/login until the existing profile check succeeds.
The installed test requires actual login fields and excludes background
navigation. Chromium returns styled uppercase login labels, so the probe
normalizes case for comparison while retaining the real AX tree.

The CI artifact contains **evidence only**, never an installer or application
package. It does not authorize distribution, employee enablement or release.
Its synthetic development flow uses the existing clearly labeled fixture
preload. The installed flow uses the real main/preload, no fake login, no
service credentials and only shipped loopback defaults.

An accessibility tree is not Narrator speech. Emulated forced colors are not
actual OS High Contrast; the separate OS step above is actual setting evidence,
not acceptance of every contrast theme or human-assistive workflow.
The ordinary installed startup check does not prove
an authenticated installed Studio workflow; the approved service/session for
that remains a Chair 1 integration dependency under #28/#25.

## Human run, isolated Windows checkout

Use a separate checkout, preserving other developers' work. Read AGENTS.md and
the collaboration rules. Use the latest exact PR #39 commit and record it;
never use an old screenshot or report merely a branch name. Do not install
over an existing employee application or use a production account.

```powershell
git fetch origin feature/tyler-dev006-combined
git switch --detach FETCH_HEAD
git status --short
git rev-parse HEAD
npm ci --no-audit --no-fund
node_modules/.bin/electron.cmd tools/website-builder/windows-manual-review.cjs
```

This opens current source with synthetic project data; it is **not the installed
application**. Its profile/evidence stays in ignored `test-output/windows-manual/`.
The synthetic banner must remain visible. No real login or provider is used.
F8 captures the current app pixels and a matching source/tree/hash/OS/media
record. Keep original files; annotate the issue separately. Do not commit local
profiles, logs, credentials or binaries.

1. Turn on Windows Narrator (Win+Ctrl+Enter). In the app, use only keyboard
   navigation to enter Studio → Website Builder and create a synthetic site.
   Verify spoken navigation/step names and every input label; proceed through
   Brief → Pages → Edit → Preview. Record actual spoken examples and failures.
   Also check website-wide accent/font labels, selected-page movement/removal,
   section type/movement/removal and Undo. Verify meaningful post-action focus
   and spoken status. In Preview, select both pages and download the site ZIP;
   confirm the selector keeps focus and both static pages open from the archive.
2. Edit an audience/body field, leave Website, and verify the unsaved dialog is
   announced, initial focus is Keep editing, Tab/Shift+Tab stays in the modal,
   Escape/Keep returns focus to its opener, and text survives. Retry with Save.
   Check the Saving/Saved/Unsaved status announcements without duplicate speech.
3. Save, quit and reopen this same review command; reopen the synthetic website.
   Check text/page retention. Test a second project and sign-out; verify cleared
   project content, including no stale website/asset details.
4. Open Assets, import a disposable synthetic text file, edit Display name, and
   leave without saving. Verify Narrator announces the actual inline warning
   and both Keep/Discard controls, Keep retains the draft, Discard completes
   navigation, and focus remains usable. F8 while the warning is visible.
5. In Windows Settings → Accessibility → Contrast themes, apply an actual
   contrast theme. Repeat navigation, fields, modal/inline warning, disabled
   controls, preview and 200% zoom. Confirm visible focus/text/borders/selected
   states and no obstructed actions. F8 records both OS and media state; attach
   one OS Settings screenshot identifying the theme, cropped to exclude private
   information. Restore the original theme and Narrator setting afterward.
6. Separately run the employee-gate fixture below and verify Studio is disabled
   and Unavailable. Use CI's **installed** results for ordinary installed startup;
   do not describe this fixture as installed-app evidence.

```powershell
node_modules/.bin/electron.cmd tools/website-builder/windows-manual-review.cjs --review-employee
```

## Result to post on issue #9 / PR #39

```text
Tester / Windows version / display scaling:
Exact git commit / tree / clean source:
Narrator version / actual spoken label and status examples:
Keyboard + modal focus + inline Asset warning: PASS / FAIL with reproduction
Save / quit / reopen / project / sign-out: PASS / FAIL
Actual OS contrast theme / 200%: PASS / FAIL with observations
Evidence PNG + matching JSON names / SHA-256:
Ordinary installed CI run and result (separate from fixture):
Authenticated installed Studio: NOT VERIFIED unless approved service run attached
Defects / next action / person:
```

Until a tester confirms and returns this record, human Narrator/OS Contrast
verification remains **requested, not completed**. Keep #9 open and all PRs
unmerged. Tyler owns follow-through; Jaxsavvy/Theecassycat retain independent
review responsibility. Any discovered renderer defect returns DEV-006 to
Building with a focused fix and rerun.
