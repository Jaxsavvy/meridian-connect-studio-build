# Local Website draft integrity follow-up

Current executable source:0d440502aedaf1031da81eaa258f57999e54dee4;
tree047c94c7ed8c383de7a5be788d9cec5a924d4a58.171 local tests pass.
Earlier pending/count entries below preserve implementation checkpoints; final
runtime acceptance is recorded at the end. All PRs remain unmerged.

DEV-006 #9 / Tyler, PR #39. Five regression cases failed against the preceding
source and pass after correction:

1. Duplicate 120-character page/scene titles appended a suffix beyond the slug
   limit, leaving drafts unsaveable. Reserve suffix space, trim boundary hyphens
   and check portable export filename collisions before insertion.
2. Home slug edits could remove index.html and bypass home deletion protection.
   Retain the home entry URL; a read-only field explains why. Other slugs remain
   editable, and rejected edits preserve Undo/Redo.
3. Syntactically valid but malformed saved data could open with missing brief,
   invalid revision, duplicate section IDs or non-text fields. Validate editor
   fields before accepting primary/backup/pending or a mutation; invalid primary
   falls through to an existing valid backup. Do not overwrite malformed records
   when all recovery candidates fail.
4. A parseable stale/empty index hid otherwise saved primary records. Union the
   index with discovered primary keys, deduplicate, then validate each candidate.
5. An older window silently overwrote newer saved content. Keep the accepted
   saved snapshot and compare current persisted content before saving; reject
   observed changes while retaining dirty local edits. Reopen/discard accepts
   the latest baseline before reapplying changes. This is local conflict
   detection, not atomic cross-process CAS, synchronization or automatic merge.

166 relevant Node tests pass; syntax/whitespace pass. Actual renderer harness
adds duplicate maximum-title save and read-only home URL assertions. Exact-source
Linux/Windows/combined runtime evidence is pending until recorded below.

Cassy PR #33 moved from3fab5ef to075ec2adcca99b60d28eaa4efeff52f24fefb9b4:
inspected all seven changed paths. Its full-byte preview/export path now refuses
non-synthetic mode before transport. Only disposable composition pins update;
Cassy files are neither rewritten nor added to Tyler's branch. Current source
remains synthetic-only; no preview/export permission or service authority added.

## Retry and exported-page follow-up

A sixth regression catches primary-success/index-failure: retain the exact own
attempt baseline only when persisted content matches that attempt, allowing an
explicit retry while keeping the original failure and dirty state visible.
167 relevant Node tests pass. Further export CSS wraps long unbroken content,
constrains CTA width and allows grid/header items to shrink. A real Chromium
check renders exported HTML with maximum site/title/body/action fields at375,
768,1440px and200% zoom, asserting actual document/heading/action bounds and
saving phone pixels. This checks generated pages independently of editor bounds.
Exact-source runtime acceptance remains pending.

## Accepted project display metadata

A seventh regression reproduced a stale project name after an accepted context
list rename. Update workspace display metadata for the same accepted ID without
reloading the fixture, clearing unsaved editor/website state or resetting jobs.
Identity/session changes retain their existing invalidation path. New Node and
mounted renderer assertions cover name refresh and retained edits; relevant
suite168 passes. No membership or authorization behavior changes.

## Preserve conflicted edits as a separate website

Save separate copy creates a new device-local website identity with current
content and a copy name, fresh revision, and independent baseline. The original
website and its checkpoint history are untouched. Undo/checkpoints reset for the
new identity; shared groups remain scoped to the copied website. A failed write
keeps the original open draft, dirty edits and Undo history. Node regressions
cover conflict preservation and quota failure; mounted UI simulates an already
committed external local record, refuses overwrite and saves the retained draft
as a second identity.170 local tests pass. This is not cloud backup or service
conflict resolution. Current runtime verification is pending.

## Earlier953bcfd runtime checkpoint

Source checks39052954751, Linux guided UI39052954762, and combined runtime
39052954752 pass. Windows installation run39052954755 also passed.
Downloaded Linux12108720542 and combined Linux12108411957/Windows12108661508,
matched archive SHA-256 to GitHub metadata and checked archive integrity.

| Artifact | Verified SHA-256 |
| --- | --- |
| Linux12108720542 | 701ea9d420e71db307d7d08a5412c3c25fea7399923d9ec9cc93e2c3fe797bbd |
| Combined Linux12108411957 | b31389e57de284ac6185da32ef0ea2e4d974552c992866a049f2b5d560cfd6fe |
| Combined Windows12108661508 | a8ed3ffefc8934641744113c485da4de8aeeb8aadd64620f3bba92d1de5258ac |

Both disposable compositions record UI953bcfd/treefc0b754, Asset075ec2a,
cleanBeforeRuntime true and composed tree6b49be1f649ddbdd2b9f936a1218b3a72d8ed1b8.
No Cassy source added to Tyler's branch or PR merged. Current records pass for
bounded URL save, project rename retaining edits, explicit copy preserving the
newer original, and exported HTML bounds at375/768/1440px plus200% zoom.
Combined Windows actual OS Contrast flags126→127→126 restore successfully.
Decoded all four ZIPs so far; semantic formatting, linked/detached content,
escaped script text and relative CTA remain valid, no executable script/#contact.

Inspected final Linux200% and combined Windows actual Contrast copy-confirmation
pixels: the full outcome is focused and visible. Earlier83bda57 capture showed
only project header although its model assertions passed;953bcfd corrects the
actual focus/scroll behavior and asserts confirmation bounds before capture.
Inspected phone exported-page pixels: maximum site/navigation names wrap inside
375px. Layout metrics separately cover heading/body/action and every tested size.
No physical phone, touch, human Narrator, live service or atomic multi-process
storage claim is made.

## Monotonic revision after history edits

An eighth failing regression showed Undo restoring an older in-memory revision,
so Save reused an existing revision number. After the accepted persisted
baseline check, advance from persisted.revision rather than the Undo snapshot.
Saving after Undo/checkpoint restore now advances monotonically;171 relevant
tests pass. This remains a local revision counter, not authoritative versioning.
A fresh exact-source run is required for this final correction.

## Final0d44050 acceptance

All four exact-source workflows pass:

| Workflow | Run |
| --- | --- |
| Source | [39053261625](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39053261625) |
| Linux guided UI | [39053261612](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39053261612) |
| Windows install/OS Contrast | [39053261631](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39053261631) |
| Combined Linux/Windows | [39053261714](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39053261714) |

Downloaded all four final archives, matched GitHub SHA-256 and integrity, read
bounded URL/name/copy/layout records for normal and actual OS Contrast runs:

| Artifact | SHA-256 |
| --- | --- |
| Linux12108567254 | 244ad61d6e281713a8bc1ea6bc33c709f75dbe27fe2aa2eedda331e099dbe48e |
| Windows12108278140 | 55dde2925361aa49db9d758c6e8797c12069ca50c9c0704a217de218d8ad144d |
| Combined Linux12108447404 | c90c6af842a147560fe08f921a0ded87ee89266d342f3dfbe91e919ecf1b8c5c |
| Combined Windows12108079567 | 55232cdda83bb95213629a6b5ad06e49f2b5b1ef7081d3cf5cc8a17377281b41 |

Final ordinary source tree047c94c matches installed-source readback; its commit
is GitHub's PR test merge. Final combined inputs pin UI0d44050 and Asset075ec2a,
clean before runtime, composed tree2d7eaca37e62ab8c139d26183d4e1cc9016951fc on
both systems. Fresh clean disposable composition198 tests passes with that same
tree; temporary merge aborted. No Cassy source added to active branch.

Revalidated all six final real website ZIPs for integrity/UTF-8, semantic markup,
linked/detached content, escaped script text and safe relative CTA. Current
Linux200% and ordinary Windows actual Contrast confirmation pixels inspected;
full saved-copy outcome visible with focus. Export bounds records pass all
four dimensions/zoom settings; both Windows OS Contrast restorations pass126→127→126.
Installed-source/startup/AX/keyboard/ordinary employee gate succeeds. No human
speech, native touch, live service, deployment or installer reliability claim.
Eight failing model/state regressions preceded the fixes; focus was corrected
after actual pixel review. All PRs stay unmerged; independent reviews remain open.
