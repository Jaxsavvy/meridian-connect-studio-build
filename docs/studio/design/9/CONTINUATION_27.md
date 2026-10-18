# Current 27-item continuation — issue9

Chair2 / Tyler; existing codex/studio-thirty-checks and PR39. Baseline89f6b6a. This report supersedes prior current-entrypoint claims, while dated prior evidence stays historical. Completion means the scoped audits, fixes, proposals and preparation below; independent human, service, policy and release acceptance remain separate.

| Item | Completed work | Evidence and limits |
|---|---|---|
| A1 | Failure expansion | Write interruption, cleanup, read failure, quota, copy retry and recovery-alias suites; full suite218 cases. |
| A2 | Malformed data | Foreign identity/envelope and malformed history retained; added safe parser diagnostic regression. |
| A3 | Long sequences | Existing18000-transition model audit, Undo/Redo, nested/shared sections and checkpoint restoration rerun. |
| A4 | Export | Actual guided ZIP/layout check plus safe-name, internal-link, escaping, Unicode and navigation regressions. |
| A5 | Layout | Guided normal/narrow/zoom/sticky/dialog probes rerun; historical20-case expansion matrix remains separately dated. |
| A6 | Accessibility | Guided keyboard, focus, labels, announcements and synthetic contrast probes; human screen-reader acceptance remains open. |
| A7 | Async/context | Stale/race/sign-out/cancel suites; new disposed-frame guard prevents late focus/render callbacks. |
| A8 | Workflow | Recovery/checkpoint retry, unsaved leave, organization and keyboard checks retain truthful local-only messages. |
| A9 | Scoped fixes | Host listeners removed/idempotent destroy; disposed frame guard; instant date sorting; date fallback; safe malformed-history diagnostic. |
| A10 | Test quality | Eight new outcome-based cases; failure assertions check exact listener ownership and retained bytes, not cosmetic wording alone. |
| A11 | Evidence | Fresh runtime captures and JSON; pre/post-fix failures retained externally. Exact final CI provenance recorded in PR39. |
| A12 | Docs | This is the current entrypoint; prior22/ordered reports are dated history. Current integration/handoff/acceptance point here. |
| A13 | Acceptance/availability | Device-local development Website functional; eight other cards remain planned/unconnected; no employee/backend acceptance inferred. |
| A14 | PR review | Eight live heads refreshed; overlap inventory saved. No other head changed since preceding review; integration order retained. |
| A15 | URL/installer | Host source forwarding findings unchanged; failed signing extraction recorded separately from historical NSIS crash. No restricted policy edits. |
| A16 | Human preparation | Walkthrough addendum below specifies scenarios and expected observations without claiming a human pass. |
| A17 | Publication | Existing PR39 only; current hosted runs/artifact results and board readback supplied at delivery. No merge/release. |
| B1 | Performance | Bounded three-tier measured load/edit/save/preview/static export/ZIP/checkpoints; single local sample, no SLA. |
| B2 | Resources | 30 mount/destroy cycles prove8live/0disposed handlers; old destroy cannot clear new instance. Source URL timers revoke after download. Heap delta informational, not leak proof. |
| B3 | Storage | Measured primary/backup/checkpoint growth using synthetic memory storage; real browser quota deliberately not inferred. Existing quota failures preserve edits. |
| B4 | Date/clock | Offset instant order, invalid/missing/future presentation, locale rendering and rollback revisions covered by new tests. |
| B5 | Localization | Expanded Arabic/Hebrew/German and combining/emoji export checked. No locale product translation or full RTL layout claim. |
| B6 | Advisories | 18 npm findings triaged below; proposed coordinated dependency upgrades, no package changes. |
| B7 | Package | Actual generated ASAR303files,46sourcefiles,0unexpected roots,0forbidden dev/docs/tools. Build failed later; full install acceptance separate. |
| B8 | Licenses | 425lock license declarations,15packaged dependency notices,Electron/Chromium notices; font/icon provenance gaps explicitly retained. |
| B9 | Clean reproduction | Tracked89f6b6a archive with no.git/local hidden files; fresh npm ci413packages and210baseline tests pass. Final source suite/CI separately verified. |
| B10 | Diagnostics | Malformed history now returns bounded actionable message without raw retained text; safe diagnostic procedure below. |

## Findings and reproduction

Before the listener/date fixes, four targeted tests failed. The fixed focused set passed21/21; a further malformed-history confidentiality regression passes. Final full suite218/218. Host lifecycle tests use the same host and VM for30mounts; they measure listener ownership, not operating-system memory. Disposed callbacks cannot render or focus replacement screens. Browser download URLs have bounded revocation timers; no persistent interval is introduced.

## Performance and storage

Synthetic tiers:3pages×5sections,20×20,50×100. Approximate serialized project sizes4.9KB,199KB,2.48MB. Save0.35/5.61/60.4ms; ZIP2.66/16.22/90.92ms. Ten checkpoints fit the first two tiers; two large checkpoints fit before the existing6MiB serialized history cap. Approximate combined UTF16 key/value footprint120408/4777704/19812460bytes. These are single Node25 memory-storage samples, not disk usage, browser capacity, employee runtime speed or capacity promises. See renders/audit-27/performance.json for all timings and heap measurements. Keep the existing retention limits; propose browser quota preflight only after defining supported storage behavior with the host chair.

## Dependency proposal

The npm audit snapshot reports18findings:4moderate,13high,1critical. Counts are advisory graph reports, not proven employee exploitability. Electron is a development dependency but becomes the distributed runtime. Most remaining paths are build/download/archive tools: electron-builder→app-builder-lib/builder-util→tar and rebuild/node-gyp/cache/extract helpers. The clean production graph resolves electron-updater6.8.9→builder-util-runtime9.7.0, outside the scanner-reported <9.7.0 range; the older builder runtime appears in the build graph. See production-dependencies.json. Electron remains a distributed-runtime concern.

The critical tar advisory concerns unbounded archive input. No live malicious archive was fetched or executed. npm suggests major upgrades including electron-builder26.15.3 and Electron44.9.0; those are scanner suggestions, not validated upgrade selections. Coordinate package/lock changes with the host/build chair, validate supported Electron APIs, regenerate the lock in a clean environment, rerun source/renderer/composition tests, then Windows installer/update/rollback and signed distribution checks. Restrict build inputs/caches to trusted provenance in the meantime. Primary references: [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/), [tar advisory](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security). No dependency or host policy change is included.

## Package and license inventory

Fresh tracked-source installation created413packages. The actual ASAR has303files,46source files,15dependency LICENSE/COPYING/NOTICE entries, no unexpected roots or forbidden development roots; Electron and Chromium notices exist beside the executable. See package-inventory.json. The Windows unpacked build then FAILED extracting signing-tool symlinks because privilege was unavailable. This partial ASAR is package-content evidence only, not a completed build or installer. Exact final Windows CI is recorded separately.

All425lock entries declare licenses; most MIT/ISC, with BSD/Apache/Python/BlueOak and alternative declarations. Declaration presence does not establish legal approval or prove notice completeness. Actual packaged dependency notices are inventoried; runtime dependency package metadata and upstream obligations require distribution review. Five bundled WOFF2files are inventoried by filename and size: Inter40023664,50024272,60024452bytes; SourceSerif440020088,60021532bytes. No standalone font license was found under src/assets. [Inter upstream](https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt) and [Source Serif upstream](https://raw.githubusercontent.com/adobe-fonts/source-serif/release/LICENSE.md) use SIL OFL1.1; Source has a reserved font name. Local binary upstream identity, modifications and embedded license were not verified. The Meridian icon/brand ownership is not inferred from its filename. Proposed distribution follow-up: establish exact binary provenance and ship matching notices in an explicitly reviewed build allowlist. No new packaged license file is silently introduced.

## Safe diagnostics and human walkthrough

Record the action, app/source version, time zone, bounded error label, whether edits remain and whether Retry/Save separate copy succeeds. Use synthetic reproduction and hashes/lengths for retained records. Do not paste saved document bodies, tokens, customer names, private paths or raw storage into issue reports. Malformed checkpoint JSON now reports format failure and preserved records without parser excerpts.

Human walkthrough prepared, not performed: reopen a saved draft after a clock/time-zone change; verify chronological order and localized date. Repeatedly leave/reopen Studio and check one keyboard action fires once. Try200%zoom and a narrow window with expanded German and Arabic/Hebrew content; inspect clipping, focus order and reading direction. Corrupt synthetic checkpoint JSON, verify actionable retry guidance without data excerpts, restore fixture and retry. Exercise large synthetic projects while observing real storage failures; do not use customer records. Narrator/assistive technology, supported employee environment, backend permissions, distribution licenses and release acceptance still need their respective external evidence.
