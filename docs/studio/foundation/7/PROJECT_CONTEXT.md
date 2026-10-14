# DEV-004 — Studio project context foundation

This is the first design-independent Studio client slice. It uses the project list returned by Connect's existing authenticated `getProjects` call. It does not create a Studio project database or a new API endpoint.

## Current behavior

- `src/renderer/studio-context.js` holds only the selected project ID and name in memory. Connect's successful project-list response supplies the allowlist. An unknown ID cannot be selected. IDs containing URL path syntax are rejected before they can be used in existing project request paths.
- A project-list refresh has a request ticket. An older response cannot replace a newer list. A failed or malformed current response clears the Studio allowlist, selection, and visible project cards/counts. Sign-out also clears the cards before a new session loads.
- Project work gets a ticket from `beginProjectRequest()`. Consumers must call `isCurrentRequest(ticket)` before showing an asynchronous result. Switching away and back still invalidates the old ticket. Sign-out resets the session, allowlist, project, and tickets.
- The existing workspace selection updates the Studio context. Revoking the selected project clears the workspace view. The top-level render and the overview, tasks, files, notes, market, and deliverables read paths check project tickets and local render order before showing results; a switch away and back cannot revive an earlier response on those paths. Sign-out clears both states. Studio context is not written to disk or browser storage.
- The chat dock requires a selected project from the accepted list. With none selected it keeps the unsent text and asks the employee to choose a project; it no longer sends a fabricated fallback ID.
- The nine tool entries are ChatGPT Images, Storyboard, Video Studio, Blender, Krita, Upscayl, Website Builder, Audio Studio, and Studio Files. Every entry reports `planned`. The existing Storyboards client tab does not prove its backend or the future Studio tool is available.

## Permission boundary

The selected ID, list membership, and tool catalogue are presentation state only. Every future Studio list, upload, generation, download, job, and review request requires an approved service contract and server-side authentication, project-membership check, and operation permission check. The client must not infer access from this module or expose a tool action merely because a tile exists.

This slice does not consume Cassy's proposed asset endpoints or Tyler's unapproved design pages. A later task can attach an approved UI and a verified availability service response. Until then, the catalogue cannot claim any tool is working.

## Verification and rollback

Run `node --test --test-isolation=none tools/studio-context/studio-context.test.cjs tools/studio-context/renderer-integration.test.cjs` and `node --check` on the edited JavaScript files. The tests use synthetic project IDs, deferred API responses, and a minimal renderer DOM harness; they make no network or provider calls. The in-process test flag is needed where the sandbox denies Node's child-process test runner.

To roll back this slice, remove the `studio-context.js` script include, the small load/selection/sign-out hooks in `app.js` and `project-workspace.js`, and the new module. No stored project data or migration needs reversal.

Runtime login, permission enforcement, provider availability, and the final Studio design remain unverified by these source tests. Storyboard requests and existing non-Studio mutation flows still require a separate audit for project switches and write-result handling.
