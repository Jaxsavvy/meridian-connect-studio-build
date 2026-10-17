# Website Studio capability audit

## Current delivery record

The table below is the historical foundation audit, not a current task-completion
claim. Combined DEV-006 work and current evidence are in
`docs/studio/design/9/DEV006_ACCEPTANCE.md`, `DEV006_VERIFICATION.md`,
`WINDOWS_REVIEW.md` and `REPOSITORY_TASK_AUDIT.md` on PR #39. Preview device
controls, mounted synthetic Assets, composed leave guards and same-project
synthetic scene-text copying have since landed. Current source `837559b` also
delivers undoable page/section reorder/remove, four section types, safe global
styles, multi-page preview and real whole-site ZIP export. See
`docs/studio/design/9/LOCAL_WEBSITE_COMPLETION.md` for fresh Linux/Windows,
actual OS Contrast, installed-app and ZIP evidence. Rich text, drag/drop,
reusable global components, nested navigation and live service/provider
integration remain undelivered; the table below retains the initial baseline.

Continuation c8566b6 delivers safe opt-in body formatting (bold/italic/paragraphs/
lists), validated internal action destinations and explicit checkpoint-history
removal with confirmation/cancel/failure retry. All 147 local tests and four
exact-source workflows pass; actual preview/controls/OS Contrast captures and
six real ZIPs were independently inspected. See
`docs/studio/design/9/FORMATTED_TEXT.md`. This is basic text formatting, not
WYSIWYG/full Markdown or authoritative publishing.

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
