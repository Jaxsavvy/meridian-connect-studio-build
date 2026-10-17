# Website Studio architecture and integration contracts

## Current client boundary

`src/renderer/studio-ui/website-builder.js` owns a versioned `meridian.website-project.v1` document. Every document carries its Meridian project ID and is validated against the currently selected accepted Connect project before load or save. Storage keys are scoped by the exact encoded Meridian project ID. A context change drops the active Website Builder document and reloads only that scope's index.

The current repository is the employee Electron client. It does not own Meridian Core, Team Hub, provider credentials, backend permission policy, production deployment, or customer storage. No renderer check is treated as authorization.

## Current local extensions — 2026-10-17

The local v1 document now also permits validated parentPageId (three navigation
levels), opt-in bodyFormat, same-website actionPageId and sharedId groups with
consistent fields. These are client-local extensions, not acceptance of the
owner's unpublished DEV-016 service schema. Checkpoints stay device-local;
observed stale writes are refused, explicit retries recognize their own partial
save, and Save separate copy creates independent website identity. Revision
increments use the accepted persisted baseline after Undo/restore. This is not
an atomic cross-process transaction, cloud backup or authoritative version store.
See LOCAL_DRAFT_INTEGRITY.md under docs/studio/design/9 for tests and limits.

## Project document

- Identity: schema, website project ID, Meridian project ID, name, created/updated timestamps, revision.
- Strategy: audience, goal, tone, offer.
- Design: safe accent token and font identifier.
- Sitemap: up to 50 uniquely identified pages with unique safe slugs.
- Content: up to 100 validated sections per page using the allowlisted hero, content, features, or CTA types.

Externally supplied records are rejected when schema, ownership, page identity, slug uniqueness, bounds, or section type is invalid.

## Persistence adapter required for authoritative integration

A future named-operation service should provide list, read, create, update, and export-job status. Each request must derive actor identity from the authenticated session; verify current project membership and requested action; use canonical revisions and idempotency keys; return safe conflict and unknown-outcome states; and never accept renderer filesystem paths or executable code. Save responses must return the canonical full document.

The local development repository writes a pending copy, retains the prior primary as backup, writes the new primary, and clears pending. Load tries primary, backup, then pending and revalidates every candidate. This improves local recovery but is not a distributed transaction or server backup.

## Preview and export

Preview and export call the same pure renderer. Text is escaped, section types and colors are allowlisted, and preview runs in a sandboxed iframe without privileges. Export produces static HTML strings only. Arbitrary generated JavaScript is not accepted or executed. Future asset URLs must be canonical service results, not renderer-selected file paths.

## AI adapter required

AI creation remains unavailable until a restricted service exposes a versioned contract for validated brief-to-project and targeted-edit proposals. The client must send a project-scoped intent, receive schema-validated proposed operations, show a human-readable preview, and apply only an explicit user-approved proposal. Provider keys, raw privileged prompts, and arbitrary code must never enter this repository.

## Cassy / Asset Library boundary

Website Builder should consume the accepted host-owned Asset Library lifecycle and canonical version identity already documented under `docs/studio/assets/8/`. Selection and placement remain separate. A placed asset must retain project, asset, version, original, and derivative identity. No integration should bypass the host leave guard or invent asset permissions.
