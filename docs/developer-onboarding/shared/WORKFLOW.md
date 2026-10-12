# Work on one approved task

The owner creates or approves an issue with a number, Chair, Priority, Module, scope, acceptance criteria, and review contact. The issue is the task record; the Project item is its board representation. A branch is a line of code changes, not a substitute for either. The AI should explain each step in ordinary language and wait for the employee to finish one step before giving the next.

## Start or resume

1. Confirm your own GitHub identity, the canonical repository, and your assigned branch with `gh api user --jq .login`, `git remote -v`, and `git status --short --branch`.
2. Open the [Project](https://github.com/users/Jaxsavvy/projects/1) and your chair view. Find the issue URL and check that its Project item has your Chair. Check the issue's acceptance criteria and latest owner decision. If anything is missing, ask the owner before coding.
3. Read `AGENTS.md`, [collaboration rules](../../development/COLLABORATION_RULES.md), [architecture](ARCHITECTURE.md), [file boundaries](FILE_BOUNDARIES.md), relevant source files, prior issue comments, and the task-specific handoff if one exists.
4. Compare your branch with the latest remote main. Do not silently rebase, reset, or merge a shared feature branch; ask Chair 1 for a sync plan if it is behind or conflicts.
5. State a small plan: files to touch, reason, tests, and any owner gate. Do not implement a broad interface or backend contract from an unapproved sketch.
6. Record the start in the issue/worklog and attempt the board transition from Ready to Building. Verify the saved value. If the API fails, mark board synchronization pending in the worklog and notify the owner.

## During work

Keep the approved issue small. Use synthetic data. Explain a command's effect before asking a nontechnical employee to run it. Do not expose customer data, production endpoints, credentials, or owner-only source to the AI. Put assumptions and unresolved backend contracts in the issue rather than disguising them as implemented behavior. If you are blocked, write the blocker and next needed decision, attempt Building to Blocked, then verify the board value. Do not make a fake “done” change merely to close a task.

Tyler must obtain owner approval for one of 2–3 polished design directions **before broad Studio UI implementation**. Cassy must use the approved design system and start with contracts or isolated prototypes; image, version, Librarian, and Upscayl service behavior needs owner-approved boundaries. Chair 1 reviews bridge, auth, packaging, permissions, and cross-chair changes.

## Test and submit

1. Review the exact diff and changed file list. Run `git diff --check`, appropriate `node --check` checks for changed JavaScript, and task-specific tests in an isolated development environment. Do not run deployment, publishing, paid APIs, production services, or mutating tests against real data. There is no `npm test` script currently; report what was and was not tested.
2. Compare each acceptance criterion with evidence. A syntax check proves syntax only; a build proves packaging only; neither proves design or backend permissions.
3. Stage only approved paths. Have the AI show `git diff --cached --name-only` and inspect the staged diff for secrets, personal paths, prohibited files, and unintended package inputs. If anything is wrong, stop and fix the local stage safely.
4. Commit the task on **your assigned feature branch** with a clear message referencing its issue. Push only that branch after the issue authorizes implementation. Never push to `main`, force-push, rewrite a shared branch, or deploy.
5. Open a pull request to `main` using `.github/PULL_REQUEST_TEMPLATE.md`. Include task number, developer, changed files, tests, screenshots when UI changes, limitations, and handoff. Request Chair 1 review. The owner alone decides whether and when to merge.
6. Record the PR URL and test evidence in the issue and task handoff. Attempt Building to Review **after** PR submission; verify GitHub saved the change. Owner-controlled verification moves Review to Testing. Only explicit owner acceptance permits Testing to Complete.

## Pause, return, or recover

At the end of each session, update the issue and the task-specific handoff with what changed, test results, commit hash, PR link, current board state, unsaved work, next safe action, and blockers. Use the [handoff template](../templates/TASK_HANDOFF_TEMPLATE.md). Do not overwrite another chair's handoff. On return, read the issue and handoff before editing; inspect `git status` first and ask the AI to explain any uncommitted changes.

If work is on the wrong branch, unexpected files are staged, a test fails, or a board update is uncertain, **stop the risky action**. Keep the working copy, capture a nonsensitive summary, and ask Chair 1 for the smallest repair. Do not use `git reset --hard`, `git clean -fd`, force-push, delete a branch, or rewrite history as a quick fix. If sensitive material was committed or shared, stop further sharing and notify the owner immediately; the owner leads containment and credential rotation.

Owner approval is required for new task scope, shared-file conflicts, design direction, backend/API or permission contract, new packaged files, paid generation, production access, release, and integration into main. The GitHub Free private-repository review policy is procedural, not enforced protection.
