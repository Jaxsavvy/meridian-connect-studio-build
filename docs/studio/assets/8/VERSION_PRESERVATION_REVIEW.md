# Loaded-version preservation

DEV-005 follow-up: controller rejects same/newer revision responses that change the loaded asset's original version identity/filename, remove an existing version, or rewrite its immutable content/lineage/media fields. Review state may change; metadata and new derivative versions remain supported. Older responses continue through existing monotonic merge without rolling back current state.

Validation runs inside request handling for list, save and reload, so IMMUTABLE_VERSION_CHANGED preserves the prior loaded records. Two regressions cover rewritten original hash/filename, removed derivative, and allowed review submission. Combined asset/worker/native/view/host suite: 49 pass; controller syntax and diff checks pass. Prior Studio/context suite remains 26 passing from the unchanged integration check.

Limits: compares records currently loaded in client memory, not durable authority. Filtering/remount can remove that comparison baseline. Full hydration is the current synthetic contract; live paging/projection needs the versioned service contract before wiring. No server authorization, byte storage immutability, audit or retention guarantee is inferred. Shared files, worker policy and packaging unchanged.
