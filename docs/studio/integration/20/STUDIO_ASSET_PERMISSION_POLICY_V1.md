# DEV-011 — Studio Asset Library permission policy v1

Status: owner decisions recorded for review on 2026-10-15. This is a public-safe policy contract for the **employee Studio Asset Library**. It grants no live access, adds no route or bridge method, and does not change Team Hub, Meridian Core, or any running service. The distinct Overseer application is outside this task.

## Owner decisions

| Decision | Studio rule |
| --- | --- |
| Project access administration | Only the owner's authenticated account may add or remove a person's Studio project access or action grants. |
| Asset approval | Only the owner's authenticated account may approve a submitted asset version in a project where that account has active membership. The owner may approve their own submission. |
| Asset export | Every account, including the owner, needs active project membership and an explicit project-scoped `asset.export` grant to export an approved version. |
| Limited preview | A project member without an export grant may view a separately authorized, reduced-fidelity preview. The preview does not provide complete version bytes. |

These decisions do not make every project member a reviewer, do not turn submission into approval, and do not make download an export grant. They do not authorize production activation or a client-side permission toggle.

## Server decision boundary

For every operation, the restricted service must derive the actor and current session from server authentication. It must check the selected project, active membership, the exact asset/version's project ownership, and the operation-specific grant. Renderer-supplied actor, role, project, action, path, or approval state is never authority. The owner account must be identified by a server-controlled, unique principal; a display name or client claim is insufficient. The owner must have active project membership to approve an asset in that project.

All grants default to denied. The owner administers grants through a separately reviewed service action with an audit event recording actor, project, subject, changed actions, time, and a nonsensitive correlation ID. Ordinary project membership must not silently imply import, metadata edit, review submission, approval, or export. Revocation must take effect on the next check and must be rechecked inside committing transactions and immediately before byte transfer or job registration.

| Action | Required server decision |
| --- | --- |
| Search, exact record read, version descriptor | Active session, active project membership, exact project/asset/version ownership, and `asset.read` grant. A descriptor never includes complete version bytes or a reusable byte URL. |
| Limited preview | Active session, active project membership, exact asset/version scope, and `asset.read` grant. Return only a service-produced, bounded, reduced-fidelity presentation artifact; recheck access when delivering it. Unsupported media types remain unavailable for preview. |
| Import begin/chunk/finalize | The same scope plus `asset.import`; recheck before finalizing bytes and lineage. |
| Metadata edit | The same scope plus `asset.metadata`, exact asset, and expected revision checked at commit. |
| Review submission | The same scope plus `review.submit`, exact version and expected revision. Submission creates an event; it never approves. |
| Review approval | Current owner principal, active membership in the asset's project, exact submitted version and expected revision, with a commit-time recheck. Self-approval by that owner principal is allowed and recorded. |
| Full-byte download/export | Active session, active project membership, exact approved version, project scope, and explicit `asset.export` grant for the actor, including the owner. Recheck immediately before transfer; no renderer-selected path or reusable public URL. |
| Grant administration | Current owner principal only, checked again in the transaction that changes a person's project access or action grants. |

An approval must record the approver, submitter, exact version, decision, time, asset revision, and whether it was self-approval. Export must record the actor, exact approved version, grant used, time, and transfer outcome. A revoked grant must not be resurrected by a retry key, cached capability manifest, queued job, or previously issued download descriptor. Approval and export remain **Unavailable** until this policy is implemented and tested in the restricted service.

## Preview and export integration gate

The owner permits members without an export grant to view a limited preview. The service must produce a bounded, reduced-fidelity presentation artifact. The exact rendition limits require implementation review. Complete version bytes are a separate export operation and require an approved version and `asset.export`. Cassy's component and the Connect host need a reviewed contract change before a live mount; this draft does not edit her branch or approve a new route.

## Isolated acceptance cases

Use disposable projects and synthetic A/B identities. No customer files, paid providers, production database writes, or service restart.

1. A project member with `review.submit` can submit one exact version but cannot approve or administer grants. A second member without an export grant cannot export it even after approval.
2. The authenticated owner can approve an exact submitted version in a project where they have active membership, including their own submission, only at the current asset revision. Without that membership, approval is denied. A stale decision and a changed-body retry cannot add a second approval event.
3. The owner can grant and revoke `asset.export` for one project member; another project and another member gain nothing. A revoked member cannot start or finish an export from a previously obtained descriptor.
4. Expired session, removed project membership, revoked action grant, substituted asset/version ID, or an attempted renderer-supplied owner claim fails closed with no cross-project existence hint.
5. A draft or changes-requested version cannot be exported as approved. Retrying a failed or uncertain export cannot bypass current authorization or create a false successful audit event.
6. Simultaneous grant revocation and approval/export attempts serialize to an auditable result; no action commits after the relevant authority is gone.
7. A member with `asset.read` but no `asset.export` can obtain a limited preview but cannot obtain complete version bytes through preview, download, a descriptor, a cached response, or a retry. The preview is a separately authorized bounded rendition; revoking membership or read access denies subsequent preview transfer.
8. The owner with project membership but no `asset.export` grant cannot export an approved version. An audited, project-scoped self-grant permits export only while it remains active; revocation denies the next transfer.

The existing client and 81-check unmounted Studio Files stage do not establish these cases. In that stage, approval/export are still disabled and its grant callback is synthetic. DEV-010 #19, DEV-011 #20, and the master queue #11 remain open; Studio Assets stay Unavailable until restricted-service and Connect integration evidence passes.
