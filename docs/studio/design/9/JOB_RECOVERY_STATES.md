# Development job and permission recovery states

Tyler DEV-006 #9 UI contribution; supports owner DEV-011 #20 without accepting
or inventing its service/permission contract. This is a labeled States exercise,
not a job service or provider integration. Ordinary employee gating is unchanged.

Scenarios: queued, running, failed, completion unknown, permission denied,
spending approval missing, access revoked. Cancellation remains requested until
a recorded simulated result confirms it; completion may arrive first. Unknown
completion blocks retry until the outcome is reconciled. A known failed/cancelled
fixture permits an explicit retry with a new request identity, at most three
attempts. No automatic retry, job submission, provider/save adapter call, output
registration/download, approval or permission/spending grant occurs.

Only data explicitly marked developmentOnly can start scenarios. Old request
IDs cannot resolve later attempts. Project switches, session reset and destruction
clear scoped job state; late outcomes cannot repopulate another project. The
exercise does not alter editor content, save/dirty state, assets or tool
availability. Unknown states and denied/revoked/cost-denied records stay closed.

The UI labels progress as synthetic, uses indeterminate progress when completion
is unknown, names disabled actions/reasons and supports focus/status feedback.
The scenario selector remains a developer exercise, never a way to override real
permissions. All nine unconnected catalogue tools stay Planned/Unavailable.

Five model regressions cover cancel races, reconcile-before-retry, stale attempts,
blocked authority, project/session/destroy clearing, editor preservation and
bounded retry. Relevant local suite:160/160. Real Electron adds unknown/cancel/
denied captures, safe retry and project-switch checks. Exact-source runtime and
visual evidence are pending implementation publication. Human Narrator and
real authorized job/service acceptance remain separate. All PRs stay unmerged.
