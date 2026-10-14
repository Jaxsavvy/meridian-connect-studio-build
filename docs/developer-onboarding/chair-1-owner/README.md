# Chair 1 — Owner and AI

**Branch:** `feature/studio-integration` · **View:** [Owner Command](https://github.com/users/Jaxsavvy/projects/1/views/3) · **Prompt:** [copy Chair 1 startup prompt](STARTUP_PROMPT.md)

You own Connect architecture and integration, security boundaries, unresolved cross-chair decisions, and final release review. The other two chairs work on their own branches. Read [START_HERE](../../../START_HERE.md), [architecture](../shared/ARCHITECTURE.md), [file boundaries](../shared/FILE_BOUNDARIES.md), [workflow](../shared/WORKFLOW.md), and the existing [collaboration rules](../../development/COLLABORATION_RULES.md).

## First day and first task

Use your own GitHub authentication, follow the [safe setup](../shared/SAFE_SETUP.md), and verify the repository/Project and clean branch. Find the next assigned issue and its Project item; if none exists, prepare assignments and acceptance criteria. Check whether feature branches are behind main and decide a safe sync procedure; do not reset or rewrite Tyler's or Cassy's work.

For each issue, identify client files, backend contract owner, project isolation, authentication, permission checks, error states, packaging impact, and required tests. Keep Core and Team Hub backend work in restricted repositories. Tyler records the selected design and coordinates tokens/components with Cassy. Chairs can merge scoped PRs after checks and evidence; reserve owner review for the integrated Studio and restricted decisions. Never treat procedural GitHub Free rules as enforced protection.

## Default scope and decisions

You may work in the client repository's documented paths for an assigned issue, including `src/main.js`, `src/preload.js`, `src/api.js`, `src/auth.js`, renderer files, packaging inputs, and docs. Every backend API or provider integration needs a written contract and permission review. The owner decides production release, paid-service use, customer-data access, security policy, new backend authority, and unresolved distribution terms.

Use the [Board and handoff guide](../shared/BOARD_AND_HANDOFF.md) to record worklogs, tests, commits, PRs, and verified status transitions. Issue Complete reflects its evidenced criteria and merged PR; it does not replace final integrated review.
