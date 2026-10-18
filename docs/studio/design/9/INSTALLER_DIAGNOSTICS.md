# Disposable installer diagnostic continuation — issue 9

Chair 2 verification follow-up on PR39, baseline 2d696f1. Scope recorded in PR before editing. No installer, package/lock, main/preload, backend or host-policy change.

The previous exact-source Windows run39165228408 failed installation on attempt1 with -1073741819 and passed on attempt2. A passing retry is not a fix. Existing logs did not identify the faulting module.

The existing CI installation step now invokes a wrapper that makes exactly one attempt, preserves failures, and always attempts a bounded evidence record once the installer is identified. It records source commit/tree, installer SHA256/length, UTC timing, exit code, executable presence and up to30 queried Application Error records from the attempt interval. Only matching Meridian installer events are retained. Only application basename, module basename, numeric exception/offset and event ID enter the report. Raw event messages, paths, command lines, account/machine names and dumps are excluded. Unrecognized fields become unavailable. Query failure/no events is explicitly inconclusive. No retry is embedded.

Nine synthetic PowerShell checks verify filtering and execution control flow without launching an executable or reading real events. They run in a separate process so mocked functions and temporary GITHUB_ENV cannot affect the actual installation step. Real Windows CI must separately exercise the wrapper and installed source checks; exact final run outcomes are recorded in the PR verification section after publication.

Evidence: test-output/windows-installer/results.json in the Windows artifact. SourceCommit can be an Actions merge commit; compare sourceTree to the published tree, installer SHA to this attempt, and artifact IDs/digests. A missing diagnostic record or unavailable event is not success. A real failing-event capture remains unverified until an intermittent failure recurs.

Next investigation, if a crash recurs: compare the safe module/exception/offset, installer hashes, runner version and exact source. Obtain a separately reviewed diagnostic plan before collecting raw dumps/logs or changing packaging. The current follow-up grants no release or distribution acceptance.
