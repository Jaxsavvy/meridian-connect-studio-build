## Task and developer

- Task number: DEV-003, issue #5 (Refs #5; owner acceptance remains pending).
- Developer / chair: Cassy / Theecassycat / Chair 3.
- Source branch: `feature/studio-assets`.
- Summary: Connect exposes project Files and Storyboard requests but does not establish Studio asset identity, version lineage or backend permissions. This documentation package separates static client evidence from proposed project-scoped asset, storage/API, Librarian and isolated Upscayl contracts, preserving originals and explicit version ancestry.

## Files changed

- `docs/studio/assets/5/README.md`: package index and ordered owner decisions.
- `docs/studio/assets/5/CLIENT_EVIDENCE.md`: source references and limits of client evidence.
- `docs/studio/assets/5/CONTRACTS.md`: proposed records, storage, API, retry and permission matrix with cross-project denial.
- `docs/studio/assets/5/LIBRARIAN.md`: naming, metadata provenance, corrections, search and later UI requirements.
- `docs/studio/assets/5/UPSCAYL.md`: conditional feasibility, process boundaries, licensing questions and owner-approved synthetic test proposal.
- `docs/studio/assets/5/PR_REVIEW.md`: persistent review description.
- `docs/development/handoffs/ISSUE-5-chair-3.md`: identity, board verification, validation and safe resume record.

## Checks performed

- Exact staged diff and issue path allowlist reviewed; whitespace checks passed.
- Relative documentation links resolve; sensitive-pattern scan found no token, credential or personal-path matches.
- Static source inspection only; no backend, production, customer data, runtime build or Upscayl installation/invocation. Backend permissions, process containment and integration are unverified.

## Screenshots or previews

Not applicable: documentation only.

## Known issues and dependencies

Every unimplemented service behavior is proposed and pending owner/Chair 1 approval. First decisions: canonical IDs/service ownership/legacy mapping; permissions, Playgrounds and retention; transfer limits and idempotency; Upscayl process/license review and later isolated test authorization. Tyler's selected design is required before integrated UI work, not architecture drafting. No application source or backend changes are included.

## AI session handoff

Codex drafted and statically reviewed the documentation within issue #5 boundaries. See `docs/development/handoffs/ISSUE-5-chair-3.md`. No live service behavior or owner acceptance is claimed. Board transition to Review must be read back after PR submission; never mark Complete.

## Owner integration review

- [ ] Exact diff and file list reviewed by owner
- [ ] CI result and stated test limits reviewed by owner
- [ ] Owner explicitly approves integration into `main`

Only the owner completes this section and merges.
