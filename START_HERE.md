# Start here

Meridian Connect is the desktop app for the Breakthrough Ventures team. We're building **Meridian Studio** inside it. The plan is `docs/PLAN.md`; the rules every AI follows are in `AGENTS.md`.

## Your lane
| You | You work on | Your issues |
|---|---|---|
| Tyler | Studio screens (frame, Space home, tiles) | label `owner:tyler` |
| Cassy | Asset Library + Image gen tool | label `owner:cassy` |
| Jax (with Claude) | Core app, server, Meridian Studio AI, reviews and merges | label `owner:jax` |

## Every work session
1. Open GitHub -> Issues -> filter by your label (`owner:tyler` or `owner:cassy`) and `status:ready`. Take the lowest-numbered one. If none, ask Jax.
2. Open your AI (ChatGPT/Codex or Claude) in your local copy of this repo.
3. Paste the issue's **"Prompt for your AI"** section into it. That's all the direction it needs.
4. Let it walk you through one step at a time. Ask it to explain anything you don't understand before you run it.
5. When the PR is open and checks pass, post the 3-line update on the issue (done / next / blocked).
6. Pick up the next `status:ready` issue in your lane and repeat. You don't need to wait for Jax: Claude reviews and merges in-lane PRs at least twice a day, and you can review each other's. If someone asked for changes on one of your PRs, fix that first.

## First-time setup (once)
In PowerShell, using **your own** GitHub account:
```
git --version
node --version
gh auth status
gh repo clone Jaxsavvy/meridian-connect-studio-build
cd meridian-connect-studio-build
npm ci --ignore-scripts --no-audit --no-fund
```
If `gh auth status` says you're not signed in, run `gh auth login --web` and finish the sign-in in your browser. Never paste a token or password into AI chat, an issue, or a commit.

## Before every new issue
```
git switch main
git pull
git switch -c wave1/<issue-number>-<short-name>
```
This gets the latest code and starts a fresh branch just for that issue.

## If something looks wrong
Wrong branch, files you didn't change, a password or key in a diff, a command that wants to "reset" or "force": stop and message Jax. Don't try to fix it.
