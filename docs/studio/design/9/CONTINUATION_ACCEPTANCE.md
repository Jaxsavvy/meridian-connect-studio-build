# Website Studio continuation acceptance — 2026-10-17

Executable source: `872b31fe1d70dc77c20336112a7f5f5992d15571`.
Tree: `0626e5255e51c450838679282e0e29bdcf06ce12`.
Application changes end at `4114056`; later runtime maintenance changes only
four workflows and documentation. This record is a documentation follow-up.
All PRs remain unmerged; no issue closure or fresh board transition is claimed.

## Delivered and exercised

- Nested page navigation: validated parents/cycles/depth, three levels,
  sibling order, parent deletion promotion and Undo, semantic nested export.
- Page/section drag reorder with Undo, visible insertion indicators, retained
  keyboard reorder and focus. Automation uses constructed renderer DragEvents
  through mounted listeners; native OS pointer/touch/autoscroll remains untested.
- Shared linked sections inside one website, synchronized content/format/CTA,
  detach/Undo/Redo and distinct instance IDs. Not cross-project templates.
- Long 120-character unbroken title/slug wrap at 200% across builder steps.
- Development-only queued/running/failed/unknown/denied/cost/revoked job states,
  reconciliation before retry, fresh attempt identity, bounded retry, pending
  cancellation and completion race, stale outcome rejection/project clearing.
  No service call, real permission authority or output artifact is introduced.
- Loaded scene Saved status and local Needs review survive scene selection;
  synthetic review remains in-memory, without authoritative submission.

161 relevant local Node tests pass; JavaScript syntax and whitespace pass.
See NESTED_NAVIGATION.md, DRAG_REORDER.md, SHARED_SECTIONS.md,
JOB_RECOVERY_STATES.md and CI_ACTION_RUNTIME.md for implementation boundaries.

## Exact-source workflow acceptance

| Workflow | Successful run |
| --- | --- |
| Connect source checks | [39000974731](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39000974731) |
| Linux guided UI | [39000974754](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39000974754) |
| Windows installed application and actual OS Contrast | [39000974747](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39000974747) |
| Disposable combined Linux/Windows runtime | [39000974713](https://github.com/Jaxsavvy/meridian-connect-studio-build/actions/runs/39000974713) |

Cross-chair inputs record UI head/tree above, Asset head
`3fab5ef500f7e321d4bab23b6dacdb87abc4a6d4`, cleanBeforeRuntime true, and
composed tree `711d66604354b89c5595a385df69041e259f7627` on both systems.
Ordinary workflows run GitHub's PR test merge, with identical source tree above;
those commit IDs differ from the branch head. Windows installed-source matching
passes. Actual OS Contrast flags 126 → 127 → 126 are restored on both Windows
runs. This is automated evidence, not human Narrator speech evaluation.

| Downloaded artifact | Verified SHA-256 |
| --- | --- |
| Linux 12088783707 | f0492f4c8e11800213279edc9abea3e09a19bdaede826d489f027780208328e8 |
| Windows 12089241227 | 2f588a80ac12157a80157b281609a1207f0132d9303473b2ab165690116045f9 |
| Combined Linux 12089640008 | d5fbe315509657264d92a263bf44fa71ca34db9715e709c4c4d7b590679476a5 |
| Combined Windows 12088664119 | 07e4ed02b8646f703bb477918bb85cf7ba3b46ad59a23a78dbbc6a6fc7fc647b |

Downloaded all four, compared their archive hashes to GitHub metadata, tested
archive integrity and read job/scene/layout evidence plus provenance. Decoded
all six real synthetic website ZIPs (two Windows variants per run), checked
UTF-8 HTML, semantic strong/em/list markup, escaped script text, relative
index.html CTA, no dead #contact or executable script, linked Services content
and detached independent Home content. Inspected final Windows actual Contrast
unknown-completion capture: both reconciliation choices and disabled retry are
visible. Inspected 200% long-label capture: title and slug wrap within sitemap.
Earlier same-feature Linux captures also inspected navigation, insertion
indicators, shared catalogue and linked controls.

Verified exact official Node24 Action pins with automatic caching disabled;
full new workflows and artifact acceptance pass. Source-check log has no Node20
Action deprecation match; existing npm dependency deprecations remain. No app
package, lockfile, installer implementation or dependency remediation changed.

## Earlier failures and outstanding evaluation

An earlier drag-source Windows run had an NSIS access violation (-1073741819)
after UI/Contrast passed. Subsequent exact-source installed runs succeed; no
installer defect fix or stability guarantee is claimed. Earlier unknown-state
Windows capture clipped recovery choices; focus/visibility correction now
produces the inspected visible choices above. Initial long-label probe exposed
footer/label overflow and led to scoped wrapping fixes before acceptance.

Independent Jaxsavvy/Theecassycat review, human Narrator observations and native
pointer/touch evaluation remain open. Full WYSIWYG, standalone cross-project
components and authoritative persistence/media/AI/publishing remain separate
work. Existing synthetic UI does not grant permission or provider authority.
