# Cassy review of draft v1 record reads

Reviewed Jax PR #36 head 786115d (studio.files.v1 draft), development mount PR #35 head 8ed3f36 and Tyler Website PR #34 head df6b85e. They remain unmerged independent work. No shared files imported or changed.

Controller reloadAsset now prefers an injected service.get({assetId,projectId,signal}), validates full canonical record scope/identity/loaded immutable versions and preserves monotonic state. Full-list fallback is limited to explicitly synthetic adapters; a service adapter without exact read returns SERVICE_UNAVAILABLE rather than treating a partial page as complete. No asset.get IPC or service route is added; existing named ServiceAdapter is unchanged and does not enable v1.

Four new tests cover exact hydration with an empty partial search list; absent capability denial; wrong asset/project and late reads; unknown mutation acknowledgement without automatic replay; renderer draft retention. Existing conflict/offline tests remain applicable. 55 combined component/worker/native/view/host tests pass, with controller syntax and exact diff/whitespace review.

Partial approval: summary/search and full hydration must be distinct, and an exact read must not enumerate pages. This slice prepares reload only. The current search API remains array-based, has no nextCursor/partial state, and must not be wired to files.search pages yet. No test claims real v1 wire conformance.

Unknown outcome remains unresolved until actor/project/operation/key/body-bound operation-status succeeds. Exact read may observe committed metadata but cannot prove that a particular operation committed. No automatic new-key retry is implemented. Mutation keys, status lookup, transfer chunking, paged history, canonical field mapping and authoritative durable persistence remain pending the versioned adapter and verified service. Keep employee Assets unavailable and Upscayl OS gate closed.
