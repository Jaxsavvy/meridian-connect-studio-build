# Development Command Board and handoffs

[Meridian Development Command](https://github.com/users/Jaxsavvy/projects/1) is the existing **private** GitHub Project. Use the [Owner Command](https://github.com/users/Jaxsavvy/projects/1/views/3), [Tyler board](https://github.com/users/Jaxsavvy/projects/1/views/4), or [Cassy board](https://github.com/users/Jaxsavvy/projects/1/views/5). The Chair field is a workstream label; it is **not** a GitHub permission or the same thing as an issue Assignee.

| Field | Valid values |
| --- | --- |
| Chair | Chair 1 — Owner; Chair 2 — Tyler; Chair 3 — Cassy; Unassigned |
| Status | Backlog; Ready; Building; Review; Testing; Complete; Blocked |
| Priority | P0 — Critical; P1 — High; P2 — Normal; P3 — Low |
| Module | Studio Foundation; Studio UI/UX; Asset Library & Librarian; Upscayl Integration; Recipe Engine; Studio Intelligence; Quality & Delivery; Infrastructure & QA; Other Meridian Systems |

The owner decides the Chair, Priority, Module, and acceptance criteria. Before an update, find the **existing issue and its existing Project item**; do not add a duplicate. Use the issue URL as the durable identity. The AI should read back the item after every update and report either the confirmed saved value or “board sync pending.” Never infer success from a command that merely started.

## Required future automatic synchronization

This is a **required future integration**, not an implemented bot or workflow in this repository. The intended transitions are:

| Event | Transition | Evidence to record |
| --- | --- | --- |
| Approved assigned work begins | Ready → Building | Issue, branch, developer, start note |
| Work cannot proceed | Building → Blocked | Blocker, owner decision needed, next check |
| Pull request submitted | Building → Review | PR URL, commit, checks, screenshots if relevant |
| Owner starts verification | Review → Testing | Verification plan and tester |
| Owner explicitly accepts | Testing → Complete | Owner decision, result, accepted commit/PR |

If review requests changes, the owner may return the item to Building with a clear correction. If a blocker is resolved, the owner chooses Ready or Building based on whether work is actively resuming. **Never mark Complete without explicit owner authorization.** Real API operations, access checks, retry/idempotency behavior, and a test with a disposable issue must be implemented and verified before anyone calls the synchronization automatic.

## Current manual procedure

Use each developer's own GitHub authorization. The Project CLI supports updating one single-select field per call:

```powershell
gh project item-list 1 --owner Jaxsavvy --format json
gh project item-edit 1 --owner Jaxsavvy --url <ISSUE_URL> --field Status --value Building
gh project item-list 1 --owner Jaxsavvy --format json
```

`<ISSUE_URL>` is a **template marker**, not a command to run literally. Replace it with the already verified repository issue URL. The AI should first verify the issue is present in the Project, the Chair matches, and the transition is allowed; use the matching Status value for the actual event. For Chair, Priority, or Module, change `--field` and `--value` only after owner authorization. The [GitHub CLI command](https://cli.github.com/manual/gh_project_item-edit) identifies the existing item by issue URL. An employee without Project write access should ask the owner to make the change.

If API authorization is denied, GitHub is offline, or readback disagrees: do not repeat writes blindly, do not claim success, and do not use the owner's login. Record the intended transition and failure in the issue or local handoff, label it **Board sync pending**, and tell Chair 1. If the issue is also unavailable, keep a local nonsensitive note and sync it when access returns. Check the live board before retrying, since another person may have updated it.

## Worklog and session handoff

For each real issue, put short milestone updates in its comments and use `docs/development/handoffs/ISSUE-<number>-chair-<number>.md` for a reviewed, task-specific handoff if the issue calls for one. Start from the [template](../templates/TASK_HANDOFF_TEMPLATE.md). Include the issue and Project item URL, branch, current Status/Priority/Module, files touched, test commands and results, commit hash, PR URL, decisions, unresolved questions, pending board sync, and the next safe step. Never include tokens, private customer data, personal settings, or owner-only backend details. Commit a handoff only on the same assigned feature branch as the work; a private uncommitted handoff can be kept locally while offline.
