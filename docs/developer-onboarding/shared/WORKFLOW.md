# Work on one assigned task

Start from an existing issue with a number, Chair, Priority, Module, scope, and acceptance criteria. The issue is the task record; the Project item is its board representation. A branch is a line of code changes, not a substitute for either. The AI should explain actions in ordinary language and carry out safe, scoped work without pausing for routine owner decisions.

## Start or resume

1. Confirm your own GitHub identity, the canonical repository, and your assigned branch with `gh api user --jq .login`, `git remote -v`, and `git status --short --branch`.
2. Open the [Project](https://github.com/users/Jaxsavvy/projects/1) and your chair view. Find the issue URL and check that its Project item has your Chair. Check the issue's acceptance criteria and latest relevant decisions. If the assignment or criteria are missing, request them before coding.
3. Read `AGENTS.md`, [collaboration rules](../../development/COLLABORATION_RULES.md), [architecture](ARCHITECTURE.md), [file boundaries](FILE_BOUNDARIES.md), relevant source files, prior issue comments, and the task-specific handoff if one exists.
4. Compare your branch with the latest remote main. Do not silently rebase, reset, or merge a shared feature branch; coordinate a sync plan with affected chairs if it is behind or conflicts.
5. State a small plan: files to touch, reason, tests, and any restricted decision. Do not present a sketch as a verified interface or backend contract.
6. Record the start in the issue/worklog and attempt the board transition from Ready to Building. Verify the saved value. If the API fails, mark board synchronization pending in the worklog and continue safe work.

## During work

Keep the assigned issue small. Use synthetic data. Explain a command's effect before asking a nontechnical employee to run it. Do not expose customer data, production endpoints, credentials, or owner-only source to the AI. Put assumptions and unresolved backend contracts in the issue rather than disguising them as implemented behavior. If you are blocked, write the blocker and next needed decision, attempt Building to Blocked, then verify the board value. Do not make a fake “done” change merely to close a task.

Tyler records a polished direction with visual evidence and communicates tokens/components to Cassy before broad shared UI integration. Cassy starts with contracts or isolated prototypes and uses the recorded design system. Image, version, Librarian, and Upscayl service behavior remains proposed until the responsible service owner verifies it. Coordinate bridge, auth, packaging, permission, and cross-chair changes with Chair 1; obtain the owner decisions listed in the collaboration rules before crossing those restricted boundaries.

## Test and submit

1. Review the exact diff and changed file list. Run `git diff --check`, appropriate `node --check` checks for changed JavaScript, and task-specific tests in an isolated development environment. Do not run deployment, publishing, paid APIs, production services, or mutating tests against real data. There is no `npm test` script currently; report what was and was not tested.
2. Compare each acceptance criterion with evidence. A syntax check proves syntax only; a build proves packaging only; neither proves design or backend permissions.
3. Stage only task paths. Have the AI show `git diff --cached --name-only` and inspect the staged diff for secrets, personal paths, prohibited files, and unintended package inputs. If anything is wrong, stop and fix the local stage safely.
4. Commit the task on **your assigned feature or task branch** with a clear message referencing its issue. Push only that branch. Never push to `main`, force-push, rewrite a shared branch, or deploy.
5. Open a pull request to `main` using `.github/PULL_REQUEST_TEMPLATE.md`. Include task number, developer, changed files, tests, screenshots when UI changes, limitations, and handoff. Resolve required reviews and shared-file conflicts. After the checks and acceptance evidence are recorded, a collaborator with write access may merge the scoped PR without routine owner approval.
6. Record the PR URL and test evidence in the issue and task handoff. Move Building → Review after PR submission and read back the value. Move Review → Testing when verification begins; move Testing → Complete when the issue's acceptance criteria have evidence and the PR is merged. Read back each transition. Record remaining dependencies separately; issue completion is not release acceptance.

## Pause, return, or recover

At the end of each session, update the issue and the task-specific handoff with what changed, test results, commit hash, PR link, current board state, unsaved work, next safe action, and blockers. Use the [handoff template](../templates/TASK_HANDOFF_TEMPLATE.md). Do not overwrite another chair's handoff. On return, read the issue and handoff before editing; inspect `git status` first and ask the AI to explain any uncommitted changes.

If work is on the wrong branch, unexpected files are staged, a test fails, or a board update is uncertain, **stop the risky action**. Keep the working copy, capture a nonsensitive summary, and make the smallest safe repair; escalate unresolved conflicts to Chair 1. Do not use `git reset --hard`, `git clean -fd`, force-push, delete a branch, or rewrite history as a quick fix. If sensitive material was committed or shared, stop further sharing and notify the owner immediately; the owner leads containment and credential rotation.

Routine design direction, scoped PR integration, and issue status changes do not require an owner approval stop. For production release, spending, customer data, security/permission policy, new backend authority, and distribution/license decisions, follow the owner-decision list in the collaboration rules. The GitHub Free private-repository review policy is procedural, not enforced protection.
