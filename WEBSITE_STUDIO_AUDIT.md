# Website Studio capability audit

## Current ordered-review delivery — October 18, 2026

The ordered review is published on existing PR #39. Source008c9ee passed
source/Linux/cross-chair/Windows-installed verification. This branch also
contains the final long-name step/save-status refinement; current PR checks
track that revision. See `docs/studio/design/9/ORDERED_DELIVERY.md` for exact
source trees, artifact hashes, screenshots, board state and remaining gates.
Earlier source IDs/test totals/package results below retain their historical
scope. Local Website data is not authoritative team storage or release acceptance.

## Current delivery record

Current executable source is `e665915` on PR #39. The 174-test local suite
passes. Runtime evidence and its exact source/run boundary are recorded for:
source checks, Linux guided UI, Windows installed application/actual OS Contrast,
and disposable cross-chair Linux/Windows runtime with Asset source `3fab5ef`.
Current continuation details are in `docs/studio/design/9/RECOVERY_CATALOGUE.md`,
`LOCAL_DRAFT_INTEGRITY.md`
and `CONTINUATION_ACCEPTANCE.md`.

| Delivered local capability | Scope and limit |
| --- | --- |
| Page hierarchy | Three navigation levels, validated parents/cycles/depth, nested preview/export navigation |
| Reordering | Page siblings and sections support drag/drop plus keyboard controls; automation constructs renderer DragEvents, not OS pointer gestures |
| Linked sections | Shared copies synchronize within one website; detach/Undo supported; not a cross-project template store |
| Text and links | Safe basic bold/italic/lists and validated internal CTA destinations; not full WYSIWYG |
| Recovery and jobs | Checkpoint removal/retry and development-only job/retry/cancel/permission states; no service authority |
| Recovery catalogue | Backup/pending-only discovery after index loss; unreadable saved records remain visible with retry, without deletion or invented content |
| Draft integrity | Bounded URLs, valid recovery shapes, orphan discovery, observed stale-write detection, partial-save retry, separate local copy and monotonic revisions |
| Scene state | Loaded Saved and locally submitted Needs review survive scene selection; local synthetic review only |
| Layout and export | Long labels wrap at 200%; whole-site ZIP and multi-page preview retained |

Authoritative storage, media, AI, publishing and permission enforcement require
owner service contracts. Independent review, human Narrator observations and
native pointer/touch evaluation remain outstanding. All PRs remain unmerged.

## Historical foundation audit

The table and initial priorities below record the original baseline; they do
not describe the current delivered local capability table above.

Audit baseline: `main` at `29a0df6` on 2026-10-14 PDT. This document distinguishes source evidence from runtime and external-service evidence.

| Capability | Status | Evidence and limit |
| --- | --- | --- |
| Studio destination and project context | PARTIAL | `src/renderer/app.js`, `studio-context.js`, and `studio-ui/**` provide a development-only destination, accepted Connect project context, stale-request rejection, and accessible shell. Ordinary employee mode remains fail-closed. |
| Client brief | PARTIAL | Website Builder now edits audience, goal, tone, and offer in the same website-project model. It is local application data, not authoritative Team Hub data. |
| Sitemap and page management | PARTIAL | Pages can be added, selected, named, and assigned unique safe slugs. Reorder/delete and nested navigation remain missing. |
| Visual page construction | PARTIAL | Users can edit reusable hero/content sections and add content sections. Drag/drop, rich text, global components, and broader section types remain missing. |
| Durable save/reopen/recovery | PARTIAL | Project-scoped browser application storage survives renderer/app restart and keeps primary, pending, and backup copies. It is not server synchronization or multi-device storage. |
| Undo/redo | PARTIAL | Up to 50 in-session supported website edits. History does not survive restart. |
| Preview | PARTIAL | Sandboxed `srcdoc` preview renders the same project model used by export. Device toggles and full cross-page preview navigation remain missing. |
| Export | PARTIAL | The model produces independently runnable HTML for every page; UI downloads the selected page. Whole-site ZIP/folder export is not yet wired. |
| Assets | PARTIAL | Cassy's accepted Asset Library client and host lifecycle exist on `main`; Website Builder placement is not yet connected. |
| AI generation | BLOCKED | No approved Website Builder provider/service contract or configured provider exists in this client. No mock is presented as production AI. |
| Authorization | BLOCKED | Renderer isolation and project ID validation exist, but authoritative membership and action checks belong to the separately managed service. |
| Packaging | PARTIAL | An unsigned Windows NSIS installer built successfully and includes the Website Builder module. The installer was not executed, installed, signed, or distributed. |

## Initial findings

The live GitHub repository is `Jaxsavvy/meridian-connect-studio-build`. The requested branch `feature/tyler-website-studio-ui` and reported commit `52daa2f` were absent from GitHub and every located local Git object store. No reported recovery ZIP or publication guide was located. Current `main` already included merged DEV-006 Studio UI, accessibility continuation, shared project context, and Asset Library host work; those were preserved.

The five highest-priority gaps were durable website projects, a functional builder, reopen/recovery, model-consistent preview/export, and honest AI/service integration. The first four now have an initial implementation; the fifth remains an explicit dependency.

## Architecture recommendation

Keep the Website Builder model renderer-side only while it is a development capability. Use the existing accepted Connect project as the scope key. Keep generated HTML inert inside a sandboxed preview. Introduce a versioned named-operation adapter only after the restricted service owner supplies authenticated project membership, revision, idempotency, asset, and publish contracts. Do not expose arbitrary generated code to Electron privileges.

## Completion priorities

1. Finish page/section operations, responsive controls, shared styles, asset placement, and whole-site export.
2. Replace local-only persistence with a versioned authoritative adapter while retaining offline/recovery behavior.
3. Add validated AI generation and targeted-edit contracts without embedding provider credentials in the client.
4. Exercise full Electron runtime, 200% zoom, keyboard, screen reader, high contrast, Windows package, and installed application flows.
5. Integrate with issue #9 and owner review without describing unresolved service dependencies as complete.
