# Verification Action runtime maintenance

Scoped DEV-006 #9 verification maintenance, coordinated on PR #39; relevant to
owner #28's build-log maintenance. No application dependency, package/installer,
permission policy, service, workflow trigger or production change.

Actual preceding logs warned that checkout/setup-node/upload-artifact v4 target
Node20. Official v7 commits and action manifests were retrieved and verified;
they declare Node24. Four verification workflows now use immutable pins:

| Official action | Verified commit |
| --- | --- |
| actions/checkout v7 | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/setup-node v7 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| actions/upload-artifact v7 | cf430e030ddbb5b0abf93d22962f4752f3646cd9 |

Primary manifests: [checkout](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml),
[setup-node](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml),
[upload-artifact](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml).

Preserved read-only permissions, persist-credentials:false, Node24 test runtime,
commands, pinned synthetic inputs, artifact ZIP behavior, paths and retention.
Set package-manager-cache:false explicitly so automatic caching is not introduced
by the action upgrade. Parsed old/new YAML with BaseLoader and compared their
complete graph after normalizing these two intended changes: no other semantic
difference in any of the four workflows. Whitespace passes. Existing app source
and local 161-test suite are unchanged. All four exact-source workflows and downloaded artifact readback now pass;
see CONTINUATION_ACCEPTANCE.md for run IDs, trees and archive hashes.

No installer stability fix or app dependency/audit remediation is claimed. All
PRs remain unmerged. Rollback restores the four old workflow refs/inputs without
changing application code or evidence already recorded for earlier sources.
