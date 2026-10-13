# Safe setup and first day

Use your **own** GitHub account and a fresh development folder on your own computer. The source repository is public, but the owner must grant collaborator access before you push and Project access before you update the private board. You also need an approved issue. An invitation is not something your AI should create. Never use the owner's credentials or publish private work in this repository.

## 1. Install and sign in

On Windows, install Git, Node.js 24 with npm (the repository CI uses Node 24), the official GitHub CLI, and Codex or Claude Code through their official installers. If company IT manages your computer, follow its installation process. In PowerShell, ask your AI to explain and run:

```powershell
git --version
node --version
npm --version
gh --version
gh auth status
```

If `gh auth status` shows you are not signed in, run `gh auth login --hostname github.com --web --git-protocol https --scopes repo,project` and complete the normal GitHub browser/device flow yourself. Then run `gh api user --jq .login` and confirm the reported GitHub username is your own. **Never paste a device code, token, or password into an issue, AI chat, or terminal transcript sent to someone else.** If Projects access is missing, use `gh auth refresh --scopes project` with your own account and complete its browser flow. Ask the owner for access if the repository or Project remains unavailable.

## 2. Clone and enter your assigned branch

Choose a new folder outside any production Meridian installation. From its parent folder:

```powershell
gh repo clone Jaxsavvy/meridian-connect-studio-build meridian-connect-studio-build
cd meridian-connect-studio-build
git remote -v
git fetch origin
git switch --track origin/feature/studio-ui
git status --short --branch
```

Replace the last branch with `feature/studio-integration` for Chair 1 or `feature/studio-assets` for Chair 3. If the branch already exists locally, your AI should inspect it and use `git switch <branch>`; do not reset, rebase, or overwrite work to make a command pass. Confirm `origin` is `https://github.com/Jaxsavvy/meridian-connect-studio-build.git` and the working tree is clean. The existing feature branches may lag behind main; Chair 1 decides the safe synchronization plan before code changes.

## 3. Find your actual task

Open your [Board view](../../../START_HERE.md), the [Studio build map](../../studio/BUILD_MAP.md), and the repository's Issues tab. Your AI should match the current **GitHub issue number and URL** to the Project item, confirm its Chair, Priority, Module, Status, acceptance criteria, and the branch, and read any earlier handoff. If there is no approved issue, stop before editing and ask the owner for the next task. Do not create a duplicate issue or Project item.

## 4. Inspect source, then run safe checks

Read `AGENTS.md`, `docs/development/COLLABORATION_RULES.md`, your chair package, and the relevant code before touching it. From the cloned repository:

```powershell
git status --short --branch
node --check src/main.js
node --check src/preload.js
node --check src/api.js
node --check src/auth.js
npm ci --ignore-scripts --no-audit --no-fund
```

`npm ci` creates ignored `node_modules` in this clone and may use npm's per-user cache; it does not install over the working Meridian application. The `--ignore-scripts` check avoids running dependency installation scripts; it does **not** prepare Electron's binary for launching the app. There is no `npm test` script in v0.2.12. Run a wider syntax check or an authorized isolated app check only when the task requires it. Running Connect needs an owner-provisioned **development** service and test account; a blank/offline app without that service is not proof of a client bug. Never aim the checkout at production or use customer data.

## Common problems

| What you see | Safe next step |
| --- | --- |
| Clone or push fails | Check the canonical URL, your own GitHub login, and whether the owner granted collaborator access for pushing. Do not use the owner's token. |
| Project Board cannot be opened | Repository access and Projects authorization are separate. Check your own account and `project` scope; ask the owner about Project access. |
| `git status` shows the wrong branch or edits you did not make | Stop. Have your AI inspect the file list and coordinate a safe branch move with the owner. Do not use `reset --hard` or force push. |
| Node, npm, or `gh` is not recognized | Verify the official install, reopen PowerShell, and ask AI to show the command's location. Do not download unofficial binaries. |
| Dependency installation fails or you are offline | Keep the clone. Record the exact error without secrets; do source inspection and resume installation later. |
| App cannot reach home base | Do not point it at a live private endpoint. Ask the owner for an approved development endpoint and synthetic account. |
| No task is visible | This is a missing assignment, not a reason to invent work. Ask the owner for an issue and acceptance criteria. |

The setup and clone flow has been reviewed against the source and GitHub CLI documentation, but employee account access, machines, and a development backend have **not** been tested.
