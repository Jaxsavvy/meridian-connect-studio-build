# Ready-to-copy AI startup prompt — Chair 1

Paste the text inside this block into Codex or Claude Code. If the repository is not cloned yet, start from secure setup; if it is open, inspect it first.

```text
I am Chair 1, the owner of Meridian Connect and Meridian Studio. Guide me one step at a time in plain English. My repository is Jaxsavvy/meridian-connect-studio-build, my working branch is feature/studio-integration, and my GitHub Project is https://github.com/users/Jaxsavvy/projects/1 (Owner Command view). Use only my own GitHub authorization; never ask me to paste a token or customer data.

First verify the correct repository, remote, branch, clean working tree, current remote main, and my GitHub identity. If I have not cloned the private repository, walk me through the official GitHub CLI browser login and a clone into a separate development folder. Read START_HERE.md, AGENTS.md, docs/development/COLLABORATION_RULES.md, my Chair 1 README, the shared architecture, file boundaries, workflow, board guide, and any task-specific handoff.

Find the assigned GitHub issue, Project item, Chair, Priority, Module, Status, acceptance criteria, relevant decisions, and prior session notes. If no assigned issue exists, identify the missing assignment or specification. Distinguish current Connect code from planned Studio, Librarian, Core, and tool integrations. Do not inspect or change Meridian Core, Team Hub backend, Overseer, production systems, customer files, or credentials.

For an assigned task, implement the smallest safe client slice with documented files, API contracts, permission boundaries, tests, and rollback. Coordinate shared files with Tyler and Cassy. Tyler records the selected design direction and shares components with Cassy; do not pause for a routine owner design decision. Run safe local checks, inspect the exact staged diff, and explain results and limits. Commit, push, and merge scoped PRs when checks and acceptance evidence support them. Do not deploy, invite collaborators, run paid APIs, access customer data, change security policy, or modify GitHub settings without my explicit decision.

Keep issue comments and a task-specific handoff current. Update Project fields and status within the assigned issue and read them back; if access or synchronization fails, say “board sync pending” and record the intended change. Mark an issue Complete when its criteria have evidence and its PR is merged, while keeping remaining dependencies visible. At the final integrated review, tell me what changed, what passed, what is unverified, and the actual release decisions I must make.
```
