# DEV-003 architecture review package

Draft for Chair 1 and owner review, 2026-10-12. All Studio service behavior in this package is **proposed, unimplemented, and pending approval**. Application source was inspected read-only. No backend, production system, or customer assets were accessed; application source was not changed.

- [Client evidence](CLIENT_EVIDENCE.md)
- [Asset, storage, API and permission contracts](CONTRACTS.md)
- [Librarian and UI interface requirements](LIBRARIAN.md)
- [Upscayl feasibility and isolated test proposal](UPSCAYL.md)
- [Persistent handoff](../../../development/handoffs/ISSUE-5-chair-3.md)

First owner decisions, in dependency order:

1. Name the restricted service owner and approve canonical asset/version IDs, migration mapping from existing filename/section references, and additive API ownership. Existing Meridian services remain authoritative; no second project database.
2. Approve the permission matrix, reviewer assignment rules, download policy, retention/legal holds, and whether Playgrounds is supported. Default Playgrounds and cross-project sharing to denied until explicit rules exist.
3. Approve upload limits, resumability, quota reservations, storage layout, metadata revision concurrency, and idempotency retention.
4. Approve the separate Upscayl process boundary and exact executable/model/license review, then authorize a synthetic isolated test. No installation or invocation is authorized by this package.
5. Obtain Tyler's selected design and approved shared tokens before integrated UI implementation. This does not block architecture drafting.

Acceptance here means documentation review only. Integration, runtime security, and owner acceptance remain unverified. Board status remains Building; never self-mark Complete.
