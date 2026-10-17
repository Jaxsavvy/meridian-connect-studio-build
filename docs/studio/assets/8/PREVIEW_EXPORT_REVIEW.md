# Preview/export policy compatibility

Reviewed PR #36 ed17ef68c0b9be4a21565dce1af9cfa6cf99ac3a and PR #38 ec1c1dcfb63acd51cc8d5d992a7a03ea9aab66a9. Policy now separates reduced-fidelity files.preview from approved full-byte download/export, requires explicit project export grant even for owner, and reserves approval to authenticated owner with active membership. Submission remains distinct from approval.

Confirmed mismatch: existing Preview selected image fetches full original bytes through controller.download. It must not be wired as limited preview. Current fix keeps this legacy path explicitly synthetic-only: non-synthetic controller download fails SERVICE_UNAVAILABLE before transport, preview/export controls disable with a clear unavailable message. Synthetic memory workflows retain their byte/hash/version checks. No limited-preview, approval or export operation/IPC is added, and no renderer claim grants authority.

Two regressions verify no service byte fetch even for approved record metadata, plus disabled image preview/export in service mode. Combined suite 73 pass; syntax/whitespace/exact diff reviewed. View check uses fake DOM, not a new mounted-service/browser claim. Mode is a development label, not authentication; server action checks remain mandatory. Existing employee gate is not modified.

Required future owner/adapter work: separate rendition identity/digest/limits/lineage from original version bytes; never compare preview bytes to original SHA; exact approved export through host-owned safe save, body-bound transfer receipt/status and current export grant. Do not infer authority from cached Approved, owner label, submission or download capability. Review-only draft policy has no live effect.

PR #36 draft review remains UNPOSTED pending Cassy wording approval; neither #36 nor #38 edited. Full service/host/distribution acceptance and composed UI evidence remain separate. Existing DEV-003 local files preserved.
