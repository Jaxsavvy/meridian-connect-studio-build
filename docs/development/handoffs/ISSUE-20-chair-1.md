# DEV-011 — Chair 1 Studio asset permissions handoff

## Identity and state

- Issue: [DEV-011 #20](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/20); existing Project #1 item `PVTI_lAHODSEV684Bmo45zhAWIO0`.
- Chair 1 — Owner; Project status Building; P1 — High; Studio Foundation. Read back on 2026-10-15.
- Task branch `task/dev011-studio-permissions`, based on main `29a0df69c1b1497c85f671daddc3b8aaa979cc8a`. See the branch's draft PR for its current commit.
- Scope: public-safe Studio Asset Library permission policy and isolated acceptance cases. No client or restricted service code is changed by this slice.

## Owner decisions recorded this session

- Only the owner's authenticated account may administer a person's Studio project access and action grants.
- Only that account may approve a submitted Studio asset version, including its own submission, and it must have active membership in that project.
- Exporting an approved version requires an explicit per-project `asset.export` grant for every account, including the owner, plus active project membership.
- A project member without an export grant may view a limited, reduced-fidelity preview, separately authorized by the service; full version bytes remain an export.
- All owner decisions requested for this policy are recorded; the owner has no implicit approval membership or export-grant exception.

## Work and limits

- `docs/studio/integration/20/STUDIO_ASSET_PERMISSION_POLICY_V1.md` records the action matrix, server checks, audit fields, revocation timing, and eight synthetic A/B acceptance scenarios.
- Preview and full-byte export need separate reviewed service and client operations before a live mount. The owner permits a limited preview; rendition limits still need implementation review.
- The owner decisions do not enable approval, export, or any new bridge. No customer data, credentials, provider calls, live database change, service restart, merge, or deployment occurred.
- Document structure and `git diff --check` were checked locally. No runtime test is claimed for a documentation-only policy draft.
- The separate private Studio Files stage passes 81 synthetic checks, but its grant callback is test-only and approval/export remain disabled. The active Team Hub database has no Studio Files tables. Loaded process bytes remain unverified.

## Next actions

1. Reconcile the owner-approved policy with DEV-010's draft `studio.files.v1` contract and Cassy's review, including a separate preview/full-byte export contract, without editing her branch.
2. Implement and test grants, approval, export, revocation and audit in an isolated restricted service. Keep Studio Assets Unavailable and Project status Building until those checks pass.
