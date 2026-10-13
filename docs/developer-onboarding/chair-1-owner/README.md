# Chair 1 — Owner and AI

**Branch:** `feature/studio-integration` · **View:** [Owner Command](https://github.com/users/Jaxsavvy/projects/1/views/3) · **Prompt:** [copy Chair 1 startup prompt](STARTUP_PROMPT.md)

You own Connect architecture and integration, security boundaries, cross-chair decisions, reviews, and releases. The other two chairs work on their own branches. Read [START_HERE](../../../START_HERE.md), [architecture](../shared/ARCHITECTURE.md), [file boundaries](../shared/FILE_BOUNDARIES.md), [workflow](../shared/WORKFLOW.md), and the existing [collaboration rules](../../development/COLLABORATION_RULES.md).

The [Studio build map](../../studio/BUILD_MAP.md) lists every Studio section and the remaining owner integration work. [DEV-004](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/7) is only the first client foundation; it does not authorize or complete backend contracts, provider jobs, file storage, cross-chair assembly, or release. [DEV-007](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/11) tracks the full owner obligation; create smaller approved owner issues for its stages and keep restricted implementation outside this public repository.

## First day and first task

Use your own GitHub authentication, follow the [safe setup](../shared/SAFE_SETUP.md), and verify the repository/Project and clean branch. Find the next approved issue and its Project item; if none exists, prepare assignments and acceptance criteria through a separate owner decision, not an invented code task. Check whether feature branches are behind main and decide a safe sync procedure; do not reset or rewrite Tyler's or Cassy's work.

For each issue, identify client files, backend contract owner, project isolation, authentication, permission checks, error states, packaging impact, and required tests. Keep Core and Team Hub backend work in restricted repositories. Review Tyler's design directions before Studio UI integration; approve tokens/components Cassy will use. Review code and check output before any main merge. Verify actual GitHub protection settings; do not treat written rules as an access control.

## Default scope and approval

You may work in the client repository's documented paths for an approved issue, including `src/main.js`, `src/preload.js`, `src/api.js`, `src/auth.js`, renderer files, packaging inputs, and docs. Every backend API or provider integration needs a written contract and permission review. This package does not itself authorize a source task, merge, invitation, deployment, release, or paid-service call; follow the approved issue and the owner's explicit decision.

Use the [Board and handoff guide](../shared/BOARD_AND_HANDOFF.md) to record worklogs, tests, commits, PRs, and verified status transitions. Do not mark Complete until you have explicitly accepted the outcome.
