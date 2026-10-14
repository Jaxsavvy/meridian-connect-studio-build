# DEV-001 developer board sync prototype

This DEV-001-specific Node.js utility is separate from Meridian Connect, Electron, Core, and CI. It uses the signed-in developer's `gh` session. It is fixed to `Jaxsavvy/meridian-connect-studio-build`, user Project #1, and existing issue #3. It never creates a Project item or edits another issue. It is not the general board updater for Tyler or Cassy.

Requires Node.js 24 and GitHub CLI with repository and user Project access. Sign in through the official `gh auth login` browser flow; do not put credentials in this repository or command arguments.

```powershell
gh auth status
node tools/board-sync/board-sync.mjs inspect
node --test --test-isolation=none tools/board-sync/board-sync.test.mjs
```

For an observation of the already saved Building state, which records a structured local handoff without a Project write:

```powershell
node tools/board-sync/board-sync.mjs sync --expected Building --target Building --event-id dev001-building-observation-1 --reason "Verified owner prototype start" --handoff docs/development/handoffs/ISSUE-3-chair-1.json
```

For a permitted future Status change, use the exact current and target values and a stable event ID. The tool reads the issue and Project item, checks Chair/Priority/Module, compares the current Status, updates only Status, reads back, and saves a keyed receipt. A retry with the same ID and saved target returns `already-applied`. A mismatch or uncertain write reports `pending` and requires manual reconciliation. GitHub Project updates have no compare-and-swap guarantee; do not run concurrent writers for the same item. The handoff JSON is nonsensitive and may be reviewed alongside the task-specific Markdown handoff.

Testing → Complete is permitted when the issue criteria have evidence and its PR is merged. Record the evidence in the reason and issue handoff. The tool still verifies identity, transition, and readback; it cannot establish acceptance evidence by itself.

The `handoff` command reads the live task and stores one structured session entry per event ID in the same JSON file. It reads the current Git branch and commit itself. Supply `--summary`, `--checks`, and `--next-action`, plus optional `--blockers`. Retrying an identical entry returns `already-recorded`; reusing the ID for different content fails. Review the JSON for sensitive content before sharing it.
